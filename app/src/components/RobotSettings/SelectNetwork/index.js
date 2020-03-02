// @flow
import React, { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import last from 'lodash/last'
import semver from 'semver'

import {
  useDispatchApiRequest,
  getRequestById,
  dismissRequest,
  PENDING,
  SUCCESS,
  FAILURE,
} from '../../../robot-api'
import { postWifiDisconnect, fetchWifiList } from '../../../networking'
import {
  NO_SECURITY,
  WPA_EAP_SECURITY,
  fetchWifiEapOptions,
  fetchWifiKeys,
  configureWifi,
  addWifiKey,
  clearConfigureWifiResponse,
} from '../../../http-api-client'
import { getConfig } from '../../../config'

import { getRobotApiVersion, startDiscovery } from '../../../discovery'
import { chainActions } from '../../../util'

import { IntervalWrapper } from '@opentrons/components'
import { SelectSsid } from './SelectSsid'
import { SelectNetworkModal } from './SelectNetworkModal'

import {
  API_MIN_VERSION,
  LIST_REFRESH_MS,
  DISCONNECT_WIFI_VALUE,
  JOIN_OTHER_VALUE,
  CONNECT,
  NETWORKING_TYPE,
} from './constants'

import { useStateSelectNetwork, stateSelector } from './hooks'
import { getActiveSsid, getSecurityType, hasSecurityType } from './utils'

import type { State } from '../../../types'
import type { RequestState } from '../../../robot-api/types'
import type { ViewableRobot } from '../../../discovery/types'
import type { PostWifiDisconnectAction } from '../../../networking/types'

type SelectNetworkProps = {| robot: ViewableRobot |}

export const SelectNetwork = ({ robot }: SelectNetworkProps) => {
  const {
    list,
    eapOptions,
    keys,
    connectingTo,
    configRequest,
    configResponse,
    configError,
  } = useSelector((state: State) => stateSelector(state, robot))

  // TODO(isk, 2/27/20): remove this feature flag and version check
  const enableWifiDisconnect = useSelector((state: State) =>
    Boolean(getConfig(state).devInternal?.enableWifiDisconnect)
  )
  const hasCorrectVersion = semver.gte(
    getRobotApiVersion(robot),
    API_MIN_VERSION
  )
  const showWifiDisconnect = enableWifiDisconnect || hasCorrectVersion

  const showConfig = configRequest && !!(configError || configResponse)

  const [
    ssid,
    setSsid,
    previousSsid,
    setPreviousSsid,
    networkingType,
    setNetworkingType,
    securityType,
    setSecurityType,
    modalOpen,
    setModalOpen,
  ] = useStateSelectNetwork(list)

  const handleDisconnectWifiSuccess = useCallback(() => {
    setSsid(null)
    setPreviousSsid(null)
    setNetworkingType(CONNECT)
    setSecurityType(null)
  }, [setSsid, setPreviousSsid, setNetworkingType, setSecurityType])

  const [
    dispatchApi,
    requestIds,
  ] = useDispatchApiRequest<PostWifiDisconnectAction>()

  const latestRequestId = last(requestIds)

  const disconnectRequest: RequestState | null = useSelector<
    State,
    RequestState | null
  >(state => getRequestById(state, latestRequestId))

  const status = disconnectRequest && disconnectRequest.status
  const error =
    disconnectRequest && disconnectRequest.error && disconnectRequest.error
  const response =
    disconnectRequest &&
    disconnectRequest.response &&
    disconnectRequest.response

  const pending = status === PENDING
  const failure = status === FAILURE

  React.useEffect(() => {
    if (status === SUCCESS) {
      handleDisconnectWifiSuccess()
    }
  }, [status, handleDisconnectWifiSuccess])

  const dispatch = useDispatch()
  const dispatchRefresh = () => dispatch(fetchWifiList(robot.name))
  const dispatchConfigure = params => {
    return dispatch(
      chainActions(
        configureWifi(robot, params),
        startDiscovery(),
        fetchWifiList(robot.name)
      )
    )
  }

  const handleValueChange = (ssidValue: string) => {
    const isJoinOrDisconnect =
      ssidValue === JOIN_OTHER_VALUE || ssidValue === DISCONNECT_WIFI_VALUE

    const currentSsid = isJoinOrDisconnect ? null : ssidValue
    const currentPreviousSsid = ssid
    const currentNetworkingType = NETWORKING_TYPE[ssidValue] || CONNECT
    const currentSecurityType = getSecurityType(list, ssidValue)
    const currentModalOpen = hasSecurityType(currentSecurityType, NO_SECURITY)

    const canFetchEapOptions =
      hasSecurityType(securityType, WPA_EAP_SECURITY) || !securityType
    if (currentModalOpen) {
      dispatch(dispatchConfigure({ ssid: ssidValue }))
    } else if (canFetchEapOptions) {
      dispatch(fetchWifiEapOptions(robot))
      dispatch(fetchWifiKeys(robot))
    }

    setSsid(currentSsid)
    setPreviousSsid(currentPreviousSsid)
    setNetworkingType(currentNetworkingType)
    setSecurityType(currentSecurityType)
    setModalOpen(!currentModalOpen)
  }

  const handleCancel = () => {
    const currentSecurityType = getSecurityType(list, previousSsid)
    setSsid(previousSsid)
    setPreviousSsid(null)
    setNetworkingType(CONNECT)
    setSecurityType(currentSecurityType)
    setModalOpen(false)
  }

  const handleDisconnectWifi = () => {
    if (previousSsid) {
      dispatchApi(postWifiDisconnect(robot.name, previousSsid))
      setModalOpen(false)
    }
  }

  // TODO: (isk: 2/27/20): Refactor this SelectNetworkModal and handlers
  return (
    <IntervalWrapper refresh={dispatchRefresh} interval={LIST_REFRESH_MS}>
      <SelectSsid
        list={list || []}
        value={getActiveSsid(list)}
        disabled={connectingTo != null}
        onValueChange={handleValueChange}
        showWifiDisconnect={showWifiDisconnect}
      />
      <SelectNetworkModal
        addKey={(file: File) => dispatch(addWifiKey(robot, file))}
        close={
          showConfig
            ? dispatch(clearConfigureWifiResponse(robot))
            : () => dispatch(dismissRequest(latestRequestId))
        }
        onDisconnectWifi={handleDisconnectWifi}
        onCancel={handleCancel}
        {...{
          connectingTo,
          pending,
          failure,
          modalOpen,
          ssid,
          previousSsid,
          networkingType,
          securityType,
          eapOptions,
          keys,
          dispatchConfigure,
          configRequest,
          configError,
          configResponse,
          response,
          error,
        }}
      />
    </IntervalWrapper>
  )
}
