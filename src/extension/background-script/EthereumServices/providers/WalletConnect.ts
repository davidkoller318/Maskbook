import { EthereumAddress } from 'wallet.ts'
import WalletConnect from '@walletconnect/client'
import { remove } from 'lodash-es'
import { updateExoticWalletFromSource } from '../../../../plugins/Wallet/services'
import { currentWalletConnectChainIdSettings } from '../../../../settings/settings'
import { ChainId } from '../../../../web3/types'
import { ProviderType } from '../../../../web3/types'

//#region tracking chain id
let currentChainId: ChainId = ChainId.Mainnet
currentWalletConnectChainIdSettings.addListener((v) => (currentChainId = v))
//#endregion

let connector: WalletConnect | null = null

export async function createConnector() {
    if (!connector) {
        connector = new WalletConnect({
            bridge: 'https://bridge.walletconnect.org',
        })
        connector.on('session_update', onUpdate)
        connector.on('disconnect', onDisconnect)
    }
    if (!connector.connected) await connector.createSession()
    return connector
}

/**
 * Request accounts from WalletConnect
 * @param timeout
 */
export async function requestAccounts(timeout: number = 3 * 60) {
    const connector = await createConnector()
    if (connector.accounts.length) return connector.accounts[0]
    return new Promise(async (resolve, reject) => {
        const onConnect = async () => {
            clearTimeout(timeoutTimer)
            removeEventListener_mimic(connector, [onConnect])
            await updateWalletInDB(connector.accounts[0], false)
            resolve(connector.accounts[0])
        }
        const timeoutTimer = setTimeout(() => {
            removeEventListener_mimic(connector, [onConnect])
            reject(new Error('timeout'))
        }, timeout)
        connector.on('connect', onConnect)
        connector.on('session_update', onConnect)
        connector.on('error', (err) => {
            clearTimeout(timeoutTimer)
            removeEventListener_mimic(connector, [onConnect])
            reject(err)
        })
    })
}

const onUpdate = async (
    error: Error | null,
    payload: {
        params: {
            chainId: number
            accounts: string[]
        }[]
    },
) => {
    console.log('DEBUG: WC - on update')
    console.log({
        error,
        payload,
    })

    if (error) return
    const { chainId, accounts } = payload.params[0]

    // update chain id settings
    currentWalletConnectChainIdSettings.value = chainId

    // update wallet in the DB
    await updateWalletInDB(accounts[0], false)
}

const onDisconnect = (error: Error | null) => {
    console.log('DEBUG: WC - on disconnect')
    console.log(error)

    if (connector) removeEventListener_mimic(connector)
    connector = null
}

function removeEventListener_mimic(connector: WalletConnect, callbacks: Function[] = [onUpdate, onDisconnect]) {
    try {
        // FIXME:
        // there is no event remover API
        remove((connector as any)._eventManager._eventEmitters, (r: any) => callbacks.includes(r.callback))
    } catch (e) {
        console.log(e)
    }
}

async function updateWalletInDB(address: string, setAsDefault: boolean = false) {
    // validate address
    if (!EthereumAddress.isValid(address)) throw new Error('Cannot found account or invalid account')

    // update wallet in the DB
    await updateExoticWalletFromSource(
        ProviderType.WalletConnect,
        new Map([[address, { address, _wallet_is_default: setAsDefault }]]),
    )
}
