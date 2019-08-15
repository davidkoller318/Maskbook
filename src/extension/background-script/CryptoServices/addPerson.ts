import * as Gun1 from '../../../network/gun/version.1'
import * as Gun2 from '../../../network/gun/version.2'
import { geti18nString } from '../../../utils/i18n'
import { queryPersonDB, PersonRecord } from '../../../database/people'
import { PersonIdentifier, PostIdentifier } from '../../../database/type'
import getCurrentNetworkWorker from '../../../social-network/utils/getCurrentNetworkWorker'
import { verifyOthersProve } from './verifyOthersProve'

async function getUserPublicKeyFromBio(user: PersonIdentifier) {
    const profile = await getCurrentNetworkWorker(user).fetchProfile(user)
    if (!(await verifyOthersProve(profile.bioContent, user))) {
        throw new Error('Not in bio!')
    }
}
async function getUserPublicKeyFromProvePost(user: PersonIdentifier) {
    let person = await Gun2.queryPersonFromGun2(user)
    if (!person || !person.provePostId || !person.provePostId.length) {
        // ? The deprecated way
        if (user.network === 'facebook.com') {
            // tslint:disable-next-line: deprecation
            person = await Gun1.queryPersonFromGun(user.userId)
            if (person) Gun2.writePersonOnGun2(user, person)
        }
        if (!person || !person.provePostId || !person.provePostId.length) {
            throw new Error('Not in gun!')
        }
    }
    const postId = new PostIdentifier(user, person.provePostId)
    const post = await getCurrentNetworkWorker(postId).fetchPostContent(postId)
    if ((await verifyOthersProve(post, user)) === false) throw new Error('Not in prove post!')
}
async function getUserPublicKeyFromNetwork(user: PersonIdentifier) {
    let bioRejected = false
    let proveRejected = false
    const errors = [] as Error[]
    const [bio, post] = [getUserPublicKeyFromBio(user), getUserPublicKeyFromProvePost(user)]
    try {
        await bio
    } catch (e) {
        errors.push(e)
        bioRejected = true
    }
    try {
        await post
    } catch (e) {
        errors.push(e)
        proveRejected = true
    }
    const person = await queryPersonDB(user)
    if ((bioRejected && proveRejected) || !person || !person.publicKey) {
        throw new Error(geti18nString('service_others_key_not_found', user.userId))
    }
    return person
}
const fetchKeyCache = new Map<string, Promise<PersonRecord>>()
/**
 * Fetch a user's public key from bio or prove post
 * @param user Identifier
 */
export function addPerson(user: PersonIdentifier): Promise<PersonRecord | null> {
    if (fetchKeyCache.has(user.toText())) {
        return fetchKeyCache.get(user.toText())!
    }
    const promise = getPerson(user)
    promise.catch(() => setTimeout(() => fetchKeyCache.delete(user.toText()), 10000))
    fetchKeyCache.set(user.toText(), promise)
    return promise.catch(() => null)
    async function getPerson(user: PersonIdentifier) {
        const person = await queryPersonDB(user)
        if (!person || !person.publicKey) return getUserPublicKeyFromNetwork(user)
        return person
    }
}
