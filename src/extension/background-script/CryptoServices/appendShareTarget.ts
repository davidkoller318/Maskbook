import * as Alpha40 from '../../../crypto/crypto-alpha-40'
import * as Alpha39 from '../../../crypto/crypto-alpha-39'
import * as Alpha38 from '../../../crypto/crypto-alpha-38'
import * as Gun1 from '../../../network/gun/version.1'
import * as Gun2 from '../../../network/gun/version.2'
import { getMyPrivateKey } from '../../../database'
import { queryLocalKeyDB } from '../../../database/people'
import { PersonIdentifier } from '../../../database/type'
import {
    prepareOthersKeyForEncryptionV40,
    prepareOthersKeyForEncryptionV39OrV38,
} from '../prepareOthersKeyForEncryption'
export async function appendShareTarget(
    version: -40 | -39 | -38,
    postIdentifier: string,
    ownersAESKeyEncrypted: string,
    iv: string,
    people: PersonIdentifier[],
    whoAmI: PersonIdentifier,
): Promise<void> {
    const cryptoProviderTable = {
        [-40]: Alpha40,
        [-39]: Alpha39,
        [-38]: Alpha38,
    }
    const cryptoProvider = cryptoProviderTable[version]
    const AESKey = await cryptoProvider.extractAESKeyInMessage(
        version,
        ownersAESKeyEncrypted,
        iv,
        (await queryLocalKeyDB(whoAmI))!,
    )
    const myPrivateKey = (await getMyPrivateKey(whoAmI))!.privateKey
    if (version === -39 || version === -38) {
        const toKey = await prepareOthersKeyForEncryptionV39OrV38(people)
        const othersAESKeyEncrypted = await Alpha39.generateOthersAESKeyEncrypted(version, AESKey, myPrivateKey, toKey)
        Gun2.publishPostAESKeyOnGun2(version, iv, othersAESKeyEncrypted)
    } else if (version === -40) {
        const toKey = await prepareOthersKeyForEncryptionV40(people)
        const othersAESKeyEncrypted = await Alpha40.generateOthersAESKeyEncrypted(-40, AESKey, myPrivateKey, toKey)
        // eslint-disable-next-line import/no-deprecated
        Gun1.publishPostAESKey(postIdentifier, whoAmI, othersAESKeyEncrypted)
    }
}
