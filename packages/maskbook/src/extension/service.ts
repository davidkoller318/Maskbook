import {
    AsyncCall,
    AsyncGeneratorCall,
    AsyncCallOptions,
    CallbackBasedChannel,
    EventBasedChannel,
} from 'async-call-rpc/full'
import { isEnvironment, Environment, WebExtensionMessage, MessageTarget } from '@dimensiondev/holoflows-kit'
import * as MockService from './mock-service'
import serializer from '../utils/type-transform/Serialization'
import { ProfileIdentifier, GroupIdentifier, PostIdentifier, PostIVIdentifier, ECKeyIdentifier } from '../database/type'

import { IdentifierMap } from '../database/IdentifierMap'
import BigNumber from 'bignumber.js'

const message = new WebExtensionMessage<Record<string, any>>({ domain: 'services' })
const log: AsyncCallOptions['log'] = {
    beCalled: true,
    localError: true,
    remoteError: true,
    sendLocalStack: true,
    type: 'pretty',
    requestReplay: process.env.NODE_ENV === 'development',
}

export class MultiShotChannel implements CallbackBasedChannel {
    newConnection(e: EventBasedChannel) {
        e.on(async (data) => {
            const result = await this.handler(data)
            result && e.send(result)
        })
    }
    private handler!: (p: unknown) => Promise<unknown | undefined>
    setup(callback: (p: unknown) => Promise<unknown | undefined>) {
        this.handler = callback
    }
}
export const BackgroundServicesAdditionalConnections: Record<string, MultiShotChannel> = {}
export const Services = {
    Crypto: add(() => import('./background-script/CryptoService'), 'Crypto', MockService.CryptoService),
    Identity: add(() => import('./background-script/IdentityService'), 'Identity'),
    UserGroup: add(() => import('./background-script/UserGroupService'), 'UserGroup'),
    Welcome: add(() => import('./background-script/WelcomeService'), 'Welcome', MockService.WelcomeService),
    Steganography: add(
        () => import('./background-script/SteganographyService'),
        'Steganography',
        MockService.SteganographyService,
    ),
    Helper: add(() => import('./background-script/HelperService'), 'Helper', MockService.HelperService),
    Provider: add(() => import('./background-script/ProviderService'), 'Provider'),
    Ethereum: add(() => import('./background-script/EthereumService'), 'Ethereum'),
}
const SERVICE_HMR_EVENT = 'service-hmr'
if (module.hot && isEnvironment(Environment.ManifestBackground)) {
    module.hot.accept(
        [
            './background-script/CryptoService',
            './background-script/IdentityService',
            './background-script/UserGroupService',
            './background-script/WelcomeService',
            './background-script/SteganographyService',
            './background-script/HelperService',
            './background-script/ProviderService',
            './background-script/EthereumService',
        ],
        () => document.dispatchEvent(new Event(SERVICE_HMR_EVENT)),
    )
}

Object.assign(globalThis, { Services })
export default Services
export const ServicesWithProgress = add(() => import('./service-generator'), 'ServicesWithProgress', {}, true)

Object.assign(globalThis, {
    ProfileIdentifier,
    GroupIdentifier,
    PostIdentifier,
    PostIVIdentifier,
    ECKeyIdentifier,
    IdentifierMap,
    BigNumber,
})
Object.defineProperty(BigNumber.prototype, '__debug__amount__', {
    get(this: BigNumber) {
        return this.toNumber()
    },
    configurable: true,
})

/**
 * Helper to add a new service to Services.* / ServicesWithProgress.* namespace.
 * @param impl Implementation of the service. Should be things like () => import("./background-script/CryptoService")
 * @param key Name of the service. Used for better debugging.
 * @param mock The mock Implementation, used in Storybook.
 */
function add<T>(impl: () => Promise<T>, key: string, mock: Partial<T> = {}, generator = false): T {
    let channel: EventBasedChannel | CallbackBasedChannel = message.events[key].bind(
        process.env.STORYBOOK ? MessageTarget.LocalOnly : MessageTarget.Broadcast,
    )

    const isBackground = isEnvironment(Environment.ManifestBackground)
    if (isBackground) {
        const serverChannel =
            BackgroundServicesAdditionalConnections[key] ||
            (BackgroundServicesAdditionalConnections[key] = new MultiShotChannel())
        serverChannel.newConnection(channel)
        channel = serverChannel
    }
    const RPC: (impl: any, opts: AsyncCallOptions) => T = (generator ? AsyncGeneratorCall : AsyncCall) as any
    if (process.env.STORYBOOK) {
        // setup mock server in STORYBOOK
        // ? -> UI developing
        RPC(
            new Proxy(mock || {}, {
                get(target: any, key: string) {
                    if (target[key]) return target[key]
                    return async () => void 0
                },
            }),
            { key, serializer: serializer, log: log, channel, strict: false },
        )
    }
    // Only background script need to provide it's implementation.
    const localImplementation: any = {}
    async function install_service(mod: () => Promise<any>, hmrLog = false) {
        const result = await mod()
        for (const method of Object.keys(result)) {
            if (hmrLog) {
                if (!(method in result)) console.log(`[HMR] Service.${key}.${method} added.`)
                else if (result[method] !== localImplementation[method])
                    console.log(`[HMR] Service.${key}.${method} updated.`)
            }
            Object.defineProperty(localImplementation, method, {
                configurable: true,
                enumerable: true,
                value: result[method],
            })
        }
        for (const method of Object.keys(localImplementation)) {
            if (!(method in result)) {
                hmrLog && console.log(`[HMR] Service.${key}.${method} removed.`)
                delete localImplementation[method]
            }
        }
        // ? Set impl back to the globalThis, it will help debugging.
        Reflect.set(globalThis, key + 'Service', localImplementation)
    }
    if (isBackground) install_service(impl)
    module.hot && setTimeout(() => document.addEventListener(SERVICE_HMR_EVENT, () => install_service(impl, true)))
    const service = RPC(localImplementation, {
        key,
        serializer,
        log,
        channel,
        preferLocalImplementation: isBackground,
        strict: isBackground,
    })
    Reflect.set(globalThis, key + 'Service', service)
    return service as any
}
