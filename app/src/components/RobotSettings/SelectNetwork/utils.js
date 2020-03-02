// @flow
import find from 'lodash/find'

import { ACTIVE } from './constants'

export const getActiveSsid = (list: WifiNetworkList) => {
  const network = find(list, ACTIVE)
  return network?.ssid || null
}

export const getSecurityType = (list: WifiNetworkList, ssid: string) => {
  const network = find(list, { ssid })
  return network?.securityType || null
}

export const hasSecurityType = (securityType: ?string, securityValue: string) =>
  securityType === securityValue
