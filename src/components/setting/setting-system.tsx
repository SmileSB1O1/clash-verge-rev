import { mutate } from "swr";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingsRounded,
  PlayArrowRounded,
  PauseRounded,
  WarningRounded,
  BuildRounded,
  DeleteForeverRounded,
} from "@mui/icons-material";
import { useVerge } from "@/hooks/use-verge";
import { useSystemProxyState } from "@/hooks/use-system-proxy-state";
import { DialogRef, Switch } from "@/components/base";
import { SettingList, SettingItem } from "./mods/setting-comp";
import { GuardState } from "./mods/guard-state";
import { SysproxyViewer } from "./mods/sysproxy-viewer";
import { TunViewer } from "./mods/tun-viewer";
import { TooltipIcon } from "@/components/base/base-tooltip-icon";
import { uninstallService, restartCore, stopCore } from "@/services/cmds";
import { useLockFn } from "ahooks";
import { Button, Tooltip } from "@mui/material";
import { useSystemState } from "@/hooks/use-system-state";

import { showNotice } from "@/services/noticeService";
import { useServiceInstaller } from "@/hooks/useServiceInstaller";

interface Props {
  onError?: (err: Error) => void;
}

const SettingSystem = ({ onError }: Props) => {
  const { t } = useTranslation();

  const { verge, mutateVerge, patchVerge } = useVerge();
  const { installServiceAndRestartCore } = useServiceInstaller();
  const {
    actualState: systemProxyActualState,
    indicator: systemProxyIndicator,
    toggleSystemProxy,
  } = useSystemProxyState();

  const { isAdminMode, isServiceMode, mutateRunningMode } = useSystemState();

  // +++ isTunAvailable 现在使用 SWR 的 isServiceMode
  const isTunAvailable = isServiceMode || isAdminMode;

  const sysproxyRef = useRef<DialogRef>(null);
  const tunRef = useRef<DialogRef>(null);

  const { enable_tun_mode, enable_auto_launch, enable_silent_start } =
    verge ?? {};

  const onSwitchFormat = (_e: any, value: boolean) => value;
  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false);
  };

  // 抽象服务操作逻辑
  const handleServiceOperation = useLockFn(
    async ({
      beforeMsg,
      action,
      actionMsg,
      successMsg,
    }: {
      beforeMsg: string;
      action: () => Promise<void>;
      actionMsg: string;
      successMsg: string;
    }) => {
      try {
        showNotice("info", beforeMsg);
        await stopCore();
        showNotice("info", actionMsg);
        await action();
        showNotice("success", successMsg);
        showNotice("info", t("Restarting Core..."));
        await restartCore();
        await mutateRunningMode();
      } catch (err: any) {
        showNotice("error", err.message || err.toString());
        try {
          showNotice("info", t("Try running core as Sidecar..."));
          await restartCore();
          await mutateRunningMode();
        } catch (e: any) {
          showNotice("error", e?.message || e?.toString());
        }
      }
    },
  );

  // 卸载系统服务
  const onUninstallService = () =>
    handleServiceOperation({
      beforeMsg: t("Stopping Core..."),
      action: uninstallService,
      actionMsg: t("Uninstalling Service..."),
      successMsg: t("Service Uninstalled Successfully"),
    });

  return (
    <SettingList title={t("System Setting")}>
      <SysproxyViewer ref={sysproxyRef} />
      <TunViewer ref={tunRef} />

      <SettingItem
        label={t("Tun Mode")}
        extra={
          <>
            <TooltipIcon
              title={t("Tun Mode Info")}
              icon={SettingsRounded}
              onClick={() => tunRef.current?.open()}
            />
            {!isTunAvailable && (
              <Tooltip title={t("TUN requires Service Mode or Admin Mode")}>
                <WarningRounded sx={{ color: "warning.main", mr: 1 }} />
              </Tooltip>
            )}
            {!isServiceMode && !isAdminMode && (
              <Tooltip title={t("Install Service")}>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  onClick={installServiceAndRestartCore}
                  sx={{ mr: 1, minWidth: "32px", p: "4px" }}
                >
                  <BuildRounded fontSize="small" />
                </Button>
              </Tooltip>
            )}
            {isServiceMode && (
              <Tooltip title={t("Uninstall Service")}>
                <Button
                  // variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={onUninstallService}
                  sx={{ mr: 1, minWidth: "32px", p: "4px" }}
                >
                  <DeleteForeverRounded fontSize="small" />
                </Button>
              </Tooltip>
            )}
          </>
        }
      >
        <GuardState
          value={enable_tun_mode ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onChange={(e) => {
            if (!isTunAvailable) return;
            onChangeData({ enable_tun_mode: e });
          }}
          onGuard={(e) => {
            if (!isTunAvailable) {
              showNotice("error", t("TUN requires Service Mode or Admin Mode"));
              return Promise.reject(
                new Error(t("TUN requires Service Mode or Admin Mode")),
              );
            }
            return patchVerge({ enable_tun_mode: e });
          }}
        >
          <Switch edge="end" disabled={!isTunAvailable} />
        </GuardState>
      </SettingItem>
      <SettingItem
        label={t("System Proxy")}
        extra={
          <>
            <TooltipIcon
              title={t("System Proxy Info")}
              icon={SettingsRounded}
              onClick={() => sysproxyRef.current?.open()}
            />
            {systemProxyIndicator ? (
              <PlayArrowRounded sx={{ color: "success.main", mr: 1 }} />
            ) : (
              <PauseRounded sx={{ color: "error.main", mr: 1 }} />
            )}
          </>
        }
      >
        <GuardState
          value={systemProxyActualState}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onGuard={(e) => toggleSystemProxy(e)}
        >
          <Switch edge="end" checked={systemProxyActualState} />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("Auto Launch")}
        extra={
          isAdminMode && (
            <Tooltip
              title={t("Administrator mode may not support auto launch")}
            >
              <WarningRounded sx={{ color: "warning.main", mr: 1 }} />
            </Tooltip>
          )
        }
      >
        <GuardState
          value={enable_auto_launch ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onChange={(e) => {
            // 移除管理员模式检查提示
            onChangeData({ enable_auto_launch: e });
          }}
          onGuard={async (e) => {
            if (isAdminMode) {
              showNotice(
                "info",
                t("Administrator mode may not support auto launch"),
              );
            }

            try {
              // 先触发UI更新立即看到反馈
              onChangeData({ enable_auto_launch: e });
              await patchVerge({ enable_auto_launch: e });
              await mutate("getAutoLaunchStatus");
              return Promise.resolve();
            } catch (error) {
              // 如果出错，恢复原始状态
              onChangeData({ enable_auto_launch: !e });
              return Promise.reject(error);
            }
          }}
        >
          <Switch edge="end" />
        </GuardState>
      </SettingItem>

      <SettingItem
        label={t("Silent Start")}
        extra={
          <TooltipIcon title={t("Silent Start Info")} sx={{ opacity: "0.7" }} />
        }
      >
        <GuardState
          value={enable_silent_start ?? false}
          valueProps="checked"
          onCatch={onError}
          onFormat={onSwitchFormat}
          onChange={(e) => onChangeData({ enable_silent_start: e })}
          onGuard={(e) => patchVerge({ enable_silent_start: e })}
        >
          <Switch edge="end" />
        </GuardState>
      </SettingItem>
    </SettingList>
  );
};

export default SettingSystem;
