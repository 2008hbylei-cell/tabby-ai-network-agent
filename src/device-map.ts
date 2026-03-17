export type DeviceType =
  | 'unknown'
  | 'cisco_ios'
  | 'cisco_nxos'
  | 'juniper_junos'
  | 'huawei_vrp'
  | 'h3c'
  | 'arista_eos'
  | 'ruijie'
  | 'zte'
  | 'linux'

export type AgentIntent =
  | 'show_config'
  | 'show_interfaces'
  | 'show_routes'
  | 'show_version'
  | 'show_logs'
  | 'save_config'
  | 'custom'

export interface DeviceCommandSet {
  detect: string[]
  intents: Record<AgentIntent, string[]>
}

export const DEVICE_LABELS: Record<DeviceType, string> = {
  unknown: 'Unknown',
  cisco_ios: 'Cisco IOS/IOS-XE',
  cisco_nxos: 'Cisco NX-OS',
  juniper_junos: 'Juniper Junos',
  huawei_vrp: 'Huawei VRP',
  h3c: 'H3C',
  arista_eos: 'Arista EOS',
  ruijie: 'Ruijie',
  zte: 'ZTE',
  linux: 'Linux/Unix',
}

export const DEFAULT_DEVICE_MAP: Record<DeviceType, DeviceCommandSet> = {
  unknown: {
    detect: ['show version', 'display version', 'show system information'],
    intents: {
      show_config: [],
      show_interfaces: [],
      show_routes: [],
      show_version: [],
      show_logs: [],
      save_config: [],
      custom: [],
    },
  },
  cisco_ios: {
    detect: ['show version'],
    intents: {
      show_config: ['show running-config'],
      show_interfaces: ['show ip interface brief'],
      show_routes: ['show ip route'],
      show_version: ['show version'],
      show_logs: ['show logging | last 200'],
      save_config: ['write memory'],
      custom: [],
    },
  },
  cisco_nxos: {
    detect: ['show version'],
    intents: {
      show_config: ['show running-config'],
      show_interfaces: ['show interface brief'],
      show_routes: ['show ip route'],
      show_version: ['show version'],
      show_logs: ['show logging last 200'],
      save_config: ['copy running-config startup-config'],
      custom: [],
    },
  },
  juniper_junos: {
    detect: ['show version'],
    intents: {
      show_config: ['show configuration | display set'],
      show_interfaces: ['show interfaces terse'],
      show_routes: ['show route'],
      show_version: ['show version'],
      show_logs: ['show log messages | last 200'],
      save_config: ['commit'],
      custom: [],
    },
  },
  huawei_vrp: {
    detect: ['display version'],
    intents: {
      show_config: ['display current-configuration'],
      show_interfaces: ['display interface brief'],
      show_routes: ['display ip routing-table'],
      show_version: ['display version'],
      show_logs: ['display logbuffer'],
      save_config: ['save'],
      custom: [],
    },
  },
  h3c: {
    detect: ['display version'],
    intents: {
      show_config: ['display current-configuration'],
      show_interfaces: ['display interface brief'],
      show_routes: ['display ip routing-table'],
      show_version: ['display version'],
      show_logs: ['display logbuffer'],
      save_config: ['save'],
      custom: [],
    },
  },
  arista_eos: {
    detect: ['show version'],
    intents: {
      show_config: ['show running-config'],
      show_interfaces: ['show interfaces status'],
      show_routes: ['show ip route'],
      show_version: ['show version'],
      show_logs: ['show logging | last 200'],
      save_config: ['copy running-config startup-config'],
      custom: [],
    },
  },
  ruijie: {
    detect: ['show version'],
    intents: {
      show_config: ['show running-config'],
      show_interfaces: ['show interface brief'],
      show_routes: ['show ip route'],
      show_version: ['show version'],
      show_logs: ['show logging | last 200'],
      save_config: ['write memory'],
      custom: [],
    },
  },
  zte: {
    detect: ['show version', 'display version'],
    intents: {
      show_config: ['show running-config'],
      show_interfaces: ['show interface brief'],
      show_routes: ['show ip route'],
      show_version: ['show version'],
      show_logs: ['show logging'],
      save_config: ['write memory'],
      custom: [],
    },
  },
  linux: {
    detect: ['uname -a'],
    intents: {
      show_config: ['cat /etc/*release'],
      show_interfaces: ['ip addr show'],
      show_routes: ['ip route'],
      show_version: ['uname -a'],
      show_logs: ['journalctl -n 200 --no-pager'],
      save_config: [],
      custom: [],
    },
  },
}

export function parseCustomDeviceMap(jsonText: string): Partial<Record<DeviceType, DeviceCommandSet>> {
  if (!jsonText.trim()) {
    return {}
  }
  try {
    const parsed = JSON.parse(jsonText)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    return parsed
  } catch {
    return {}
  }
}

export function mergeDeviceMaps(
  base: Record<DeviceType, DeviceCommandSet>,
  custom: Partial<Record<DeviceType, DeviceCommandSet>>,
): Record<DeviceType, DeviceCommandSet> {
  const result: Record<DeviceType, DeviceCommandSet> = { ...base }
  for (const key of Object.keys(custom) as DeviceType[]) {
    const value = custom[key]
    if (!value) continue
    result[key] = {
      detect: value.detect ?? base[key].detect,
      intents: {
        ...base[key].intents,
        ...(value.intents ?? {}),
      },
    }
  }
  return result
}

export function inferDeviceTypeFromText(text: string): DeviceType {
  const lower = text.toLowerCase()
  const zh = text
  if (/\bnx-os\b/.test(lower) || /nx[- ]?os/.test(lower)) return 'cisco_nxos'
  if (/cisco ios|ios xe|catalyst/.test(lower)) return 'cisco_ios'
  if (/\u601d\u79d1/.test(zh)) return 'cisco_ios'
  if (/junos|juniper/.test(lower)) return 'juniper_junos'
  if (/\u534e\u4e3a/.test(zh)) return 'huawei_vrp'
  if (/huawei|vrp/.test(lower)) return 'huawei_vrp'
  if (/\u534e\u4e09/.test(zh)) return 'h3c'
  if (/h3c/.test(lower)) return 'h3c'
  if (/arista|eos/.test(lower)) return 'arista_eos'
  if (/\u9510\u6377/.test(zh)) return 'ruijie'
  if (/ruijie|rg-/.test(lower)) return 'ruijie'
  if (/\u4e2d\u5174/.test(zh)) return 'zte'
  if (/zte/.test(lower)) return 'zte'
  if (/linux|ubuntu|debian|centos|red hat|alpine/.test(lower)) return 'linux'
  return 'unknown'
}

export function inferIntentFromText(text: string): AgentIntent {
  const lower = text.toLowerCase()
  const zh = text
  if (/config|running-config|startup-config|current-configuration/.test(lower)) return 'show_config'
  if (/\u67e5\u770b\u914d\u7f6e|\u5f53\u524d\u914d\u7f6e|\u8fd0\u884c\u914d\u7f6e/.test(zh)) return 'show_config'
  if (/interface|port|link|vlan/.test(lower)) return 'show_interfaces'
  if (/\u67e5\u770b\u63a5\u53e3|\u63a5\u53e3\u72b6\u6001|\u7aef\u53e3/.test(zh)) return 'show_interfaces'
  if (/route|routing|bgp|ospf|isis|rip/.test(lower)) return 'show_routes'
  if (/\u67e5\u770b\u8def\u7531|\u8def\u7531\u8868/.test(zh)) return 'show_routes'
  if (/version|model|system/.test(lower)) return 'show_version'
  if (/\u67e5\u770b\u7248\u672c|\u7248\u672c\u4fe1\u606f/.test(zh)) return 'show_version'
  if (/log|logging|alarm|event/.test(lower)) return 'show_logs'
  if (/\u65e5\u5fd7|\u544a\u8b66|\u4e8b\u4ef6/.test(zh)) return 'show_logs'
  if (/save|commit|write memory/.test(lower)) return 'save_config'
  if (/\u4fdd\u5b58\u914d\u7f6e|\u4fdd\u5b58/.test(zh)) return 'save_config'
  return 'custom'
}
