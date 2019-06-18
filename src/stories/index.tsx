import React from 'react'

import { storiesOf } from '@storybook/react'
import Welcome0 from '../components/Welcomes/0'
import Welcome1a1 from '../components/Welcomes/1a1'
import Welcome1a2 from '../components/Welcomes/1a2'
import Welcome1a3 from '../components/Welcomes/1a3'
import Welcome1a4v2 from '../components/Welcomes/1a4.v2'
import Welcome1b1 from '../components/Welcomes/1b1'
import Welcome2 from '../components/Welcomes/2'
import { linkTo as to, linkTo } from '@storybook/addon-links'
import { text, boolean } from '@storybook/addon-knobs'
import { action } from '@storybook/addon-actions'
import Identity from '../components/Dashboard/Identity'
import Dashboard from '../components/Dashboard/Dashboard'

import EncryptionCheckbox from '../components/InjectedComponents/EncryptionCheckbox'
import { AdditionalPostBoxUI } from '../components/InjectedComponents/AdditionalPostBox'
import { AdditionalContent } from '../components/InjectedComponents/AdditionalPostContent'
import { SelectPeopleUI } from '../components/InjectedComponents/SelectPeople'
import { DecryptPostUI } from '../components/InjectedComponents/DecryptedPost'
import { AddToKeyStoreUI } from '../components/InjectedComponents/AddToKeyStore'
import { Banner } from '../components/Welcomes/Banner'
import { useShareMenu } from '../components/InjectedComponents/SelectPeopleDialog'
import { sleep } from '../utils/utils'
import { Button } from '@material-ui/core'
import { Person } from '../database'
import { PersonIdentifier } from '../database/type'
import { RenderInShadowRootWrapper } from '../utils/jss/renderInShadowRoot'

const demoPeople: Person[] = [
    {
        fingerprint: 'FDFE333CE20ED446AD88F3C8BA3AD1AA5ECAF521',
        avatar: 'https://avatars3.githubusercontent.com/u/5390719?s=460&v=4',
        nickname: 'Jack Works',
        identifier: new PersonIdentifier('localhost', 'test'),
        groups: [],
    },
    {
        fingerprint: 'FDFE333CE20ED446AD88F3C8BA3AD1AA5ECAF521'
            .split('')
            .reverse()
            .join(''),
        avatar: 'https://avatars1.githubusercontent.com/u/3343358?s=460&v=4',
        nickname: 'Robot of the century',
        identifier: new PersonIdentifier('localhost', 'test'),
        groups: [],
    },
    {
        fingerprint: 'a2f7643cd1aed446ad88f3c8ba13843dfa2f321d',
        nickname: 'Material Design',
        identifier: new PersonIdentifier('localhost', 'test'),
        groups: [],
    },
    {
        fingerprint: 'a2f7643cd1aed446ad88f3c8ba13843dfa2f321d',
        nickname: 'コノハ',
        identifier: new PersonIdentifier('localhost', 'test'),
        groups: [],
    },
]
storiesOf('Welcome', module)
    .add('Banner', () => <Banner close={action('Close')} getStarted={to('Welcome', 'Step 0')} />)
    .add('Step 0', () => (
        <Welcome0 close={action('Close')} create={to('Welcome', 'Step 1a-1')} restore={to('Welcome', 'Step 1b-1')} />
    ))
    .add('Step 1a-1 (Unused)', () => <Welcome1a1 next={to('Welcome', 'Step 1a-2')} />)
    .add('Step 1a-2', () => <Welcome1a2 next={to('Welcome', 'Step 1a-3')} />)
    .add('Step 1a-3', () => <Welcome1a3 next={to('Welcome', 'Step 1a-4')} />)
    .add('New Step 1a-4', () => (
        <Welcome1a4v2
            provePost={text('Prove', '🔒ApfdMwLoV/URKn7grgcNWdMR2iWMGdHpQBk5LVGFxhul🔒')}
            requestAutoVerify={action('Auto')}
            requestManualVerify={action('Manual')}
        />
    ))
    .add('Step 1b-1', () => <Welcome1b1 back={linkTo('Welcome', 'Step 0')} restore={action('Restore with')} />)
    .add('Step 2', () => <Welcome2 />)

storiesOf('Dashboard (unused)', module)
    .add('Identity Component (unused)', () => <Identity person={demoPeople[0]} onClick={action('Click')} />)
    .add('Dashboard (unused)', () => (
        <Dashboard
            addAccount={action('Add account')}
            exportBackup={action('Export backup')}
            onProfileClick={action('Click on profile')}
            identities={demoPeople}
        />
    ))
const FakePost: React.FC<{ title: string }> = props => (
    <>
        {props.title}
        <div style={{ marginBottom: '2em', maxWidth: 500 }}>
            <img width={500} src={require('./post-a.jpg')} style={{ marginBottom: -4 }} />
            <div
                style={{
                    border: '1px solid #dfe0e2',
                    background: 'white',
                    borderBottom: 0,
                    borderTop: 0,
                    padding: '0 12px 6px',
                    transform: 'translateY(-14px)',
                }}>
                {props.children}
            </div>
            <img style={{ marginTop: -20 }} width={500} src={require('./post-b.jpg')} />
        </div>
    </>
)

storiesOf('Injections', module)
    .add('Checkbox (unused)', () => <EncryptionCheckbox onCheck={action('Check')} />)
    .add('AdditionalPostBox', () => <AdditionalPostBoxUI people={demoPeople} onRequestPost={action('onRequestPost')} />)
    .add('Additional Post Content', () => <AdditionalContent title="Additional Content" children="Content" />)
    .add('SelectPeople', () => {
        function SelectPeople() {
            const [selected, select] = React.useState<Person[]>([])
            return <SelectPeopleUI people={demoPeople} selected={selected} onSetSelected={select} />
        }
        return <SelectPeople />
    })
    .add('Select people dialog', () => {
        function SelectPeople() {
            const { ShareMenu, showShare } = useShareMenu(
                demoPeople,
                async people => sleep(3000),
                boolean('Has frozen item?', true) ? [demoPeople[0]] : [],
            )
            return (
                <RenderInShadowRootWrapper>
                    {ShareMenu}
                    <Button onClick={showShare}>Show dialog</Button>
                </RenderInShadowRootWrapper>
            )
        }
        return <SelectPeople />
    })
    .add('Decrypted post', () => {
        const msg = text(
            'Post content',
            `
        This is a post
        that with multiline.

        Hello world!`,
        )
        const vr = boolean('Verified', true)
        return (
            <>
                <FakePost title="Decrypted:">
                    <DecryptPostUI.success
                        alreadySelectedPreviously={[]}
                        requestAppendDecryptor={async () => {}}
                        people={demoPeople}
                        data={{ content: msg, signatureVerifyResult: vr }}
                    />
                </FakePost>
                <FakePost title="Decrypting:">{DecryptPostUI.awaiting}</FakePost>
                <FakePost title="Failed:">
                    <DecryptPostUI.failed error={new Error('Error message')} />
                </FakePost>
            </>
        )
    })
    .add('Verify Prove Post', () => {
        return (
            <>
                <FakePost title="Success:">{AddToKeyStoreUI.success}</FakePost>
                <FakePost title="Verifying:">{AddToKeyStoreUI.awaiting}</FakePost>
                <FakePost title="Failed:">
                    <AddToKeyStoreUI.failed error={new Error('Verify Failed!')} />
                </FakePost>
            </>
        )
    })
