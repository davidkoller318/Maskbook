/** This file is published under MIT License */
import { useEffect, useState } from 'react'
import { useAsync } from '../components/AsyncComponent'
import { has } from 'lodash-es'

const q = <const>['query', 'request', 'revoke']

export function checkPermissionApiUsability(type?: typeof q[number]) {
    const r: Partial<{ [T in typeof q[number]]: boolean }> = {}
    for (const v of q) {
        r[v] = has(navigator, `permissions.${v}`)
    }
    if (type) {
        return r[type]
    }
    return r as Required<typeof r>
}

export function useRequestCamera(needRequest: boolean) {
    const [permission, updatePermission] = useState<PermissionState>('prompt')
    useEffect(() => {
        let permissionStatus: PermissionStatus | undefined = undefined
        const update = () => updatePermission(permissionStatus!.state)
        if (checkPermissionApiUsability('query')) {
            navigator.permissions.query({ name: 'camera' }).then(p => {
                permissionStatus = p
                p.onchange = update
                update()
            })
        } else {
            permissionStatus = {
                onchange: null,
                state: 'granted',
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => true,
            }
            update()
        }
        return () => {
            if (permissionStatus) permissionStatus.onchange = null
        }
    }, [])
    useAsync(() => {
        if (needRequest && permission !== 'granted') requestPermission()
        return Promise.resolve()
    }, [permission, needRequest])
    return permission
}
async function requestPermission(): Promise<unknown> {
    if (checkPermissionApiUsability('request')) {
        // @ts-ignore
        if (navigator.permissions.request) return navigator.permissions.request({ name: 'camera' })
    } else {
        const t = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
            },
        })
        t.getTracks()[0].stop()
    }
}
export async function getFrontVideoDevices() {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(devices => devices.kind === 'videoinput')
    const back = devices.find(
        device =>
            (device.label.toLowerCase().search('back') !== -1 || device.label.toLowerCase().search('rear') !== -1) &&
            device.label.toLowerCase().search('front') === -1,
    )
    if (back) return back.deviceId
    if (devices[0]) return devices[0].deviceId
    return null
}
