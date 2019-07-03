import React, { useState } from 'react'
import { LiveSelector, MutationObserverWatcher, DomProxy } from '@holoflows/kit'
import { DecryptPostUI } from '../../../components/InjectedComponents/DecryptedPost'
import { AddToKeyStore } from '../../../components/InjectedComponents/AddToKeyStore'
import { getPersonIdentifierAtFacebook, useIdentitiesAtFacebook } from './MyUsername'
import { renderInShadowRoot } from '../../../utils/jss/renderInShadowRoot'
import { usePeople } from '../../../components/DataSource/PeopleRef'
import { useAsync } from '../../../utils/components/AsyncComponent'
import { deconstructPayload } from '../../../utils/type-transform/Payload'
import Services from '../../service'
import { PersonIdentifier, PostIdentifier } from '../../../database/type'
import { Person } from '../../../database'
import { isMobile } from '../../../social-network/facebook.com/isMobile'

const posts = new LiveSelector().querySelectorAll<HTMLDivElement>(
    isMobile ? '.story_body_container ' : '.userContent, .userContent+*+div>div>div>div>div',
)

interface PostInspectorProps {
    post: string
    postBy: PersonIdentifier
    postId: string
    needZip(): void
}
function PostInspector(props: PostInspectorProps) {
    const { post, postBy, postId } = props
    const whoAmI = (useIdentitiesAtFacebook()[0] || { identifier: PersonIdentifier.unknown }).identifier
    const people = usePeople()
    if (postBy.isUnknown) return null
    const type = {
        encryptedPost: deconstructPayload(post),
        provePost: post.match(/🔒(.+)🔒/)!,
    }
    if (type.encryptedPost) {
        props.needZip()
        const [alreadySelectedPreviously, setAlreadySelectedPreviously] = useState<Person[]>([])
        const { iv, ownersAESKeyEncrypted } = type.encryptedPost
        if (whoAmI.equals(postBy)) {
            useAsync(() => Services.Crypto.getSharedListOfPost(iv), [post]).then(p => setAlreadySelectedPreviously(p))
        }
        return (
            <DecryptPostUI.UI
                requestAppendDecryptor={async people => {
                    setAlreadySelectedPreviously(alreadySelectedPreviously.concat(people))
                    return Services.Crypto.appendShareTarget(
                        iv,
                        ownersAESKeyEncrypted,
                        iv,
                        people.map(x => x.identifier),
                        whoAmI,
                    )
                }}
                alreadySelectedPreviously={alreadySelectedPreviously}
                people={people}
                encryptedText={post}
                whoAmI={whoAmI}
                postBy={postBy}
            />
        )
    } else if (type.provePost) {
        Services.People.uploadProvePostUrl(new PostIdentifier(postBy, postId))
        return <AddToKeyStore postBy={postBy} provePost={post} />
    }
    return null
}
new MutationObserverWatcher(posts)
    .assignKeys(node => node.innerText)
    .useForeach(node => {
        // Get author
        const postBy = getPostBy(node)
        // Get post id
        const postId = getPostID(node)
        // Click "See more" if it may be a encrypted post
        {
            const more = node.current.parentElement!.querySelector<HTMLSpanElement>('.see_more_link_inner')
            if (!isMobile && more && node.current.innerText.match(/🎼.+|/)) {
                more.click()
            }
        }
        function zipPostContent() {
            const pe = node.current.parentElement
            // Style modification for repost
            if (!node.current.className.match('userContent') && node.current.innerText.length > 0) {
                node.after.setAttribute(
                    'style',
                    `
                border: 1px solid #ebedf0;
                display: block;
                border-top: none;
                border-bottom: none;
                margin-bottom: -23px;
                padding: 0px 10px;`,
                )
            }
            if (pe) {
                const p = pe.querySelector('p')
                if (p) {
                    p.style.display = 'block'
                    p.style.maxHeight = '20px'
                    p.style.overflow = 'hidden'
                    p.style.marginBottom = '0'
                }
            }
        }
        function zipPostLinkPreview() {
            const img = node.current.parentElement!.querySelector('a[href*="maskbook.io"] img')
            const parent = img && img.closest('span')
            if (img && parent) {
                parent.style.display = 'none'
            }
        }
        function needZip() {
            zipPostContent()
            zipPostLinkPreview()
        }
        // Render it
        return renderInShadowRoot(
            <PostInspector needZip={needZip} postId={postId || ''} post={node.current.innerText} postBy={postBy} />,
            node.afterShadow,
        )
    })
    .setDomProxyOption({ afterShadowRootInit: { mode: 'closed' } })
    .omitWarningForRepeatedKeys()
    .startWatch()

function getPostBy(node: DomProxy) {
    const dom = isMobile ? node.current.querySelectorAll('a') : [node.current.parentElement!.querySelectorAll('a')[1]]
    return getPersonIdentifierAtFacebook(Array.from(dom))
}
function getPostID(node: DomProxy) {
    if (isMobile) {
        const abbr = node.current.querySelector('abbr')
        if (!abbr) return null
        const idElement = abbr.closest('a')
        if (!idElement) return null
        const id = new URL(idElement.href)
        return id.searchParams.get('id') || ''
    } else {
        // In single url
        if (location.href.match(/plugins.+(perma.+story_fbid%3D|posts%2F)?/)) {
            const url = new URL(location.href)
            return url.searchParams.get('id')
        } else {
            // In timeline
            const parent = node.current.parentElement
            if (!parent) return ''
            const idNode = parent.querySelector('div[id^=feed]')
            if (!idNode) return ''
            return idNode.id.split(';')[2]
        }
    }
}
