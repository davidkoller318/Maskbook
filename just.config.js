const { task, series, parallel } = require('just-task')
const args = require('just-task').argv()
const { spawn } = require('child_process')
const { watch } = require('chokidar')
const adb = require('adbkit').createClient()
const path = require('path')
const fs = require('fs-extra')

const profile = path.join(process.cwd(), `.firefox`)

const prettierCommand = async (str, level = 'log') => {
    await step(['prettier', `--${str}`, './src/**/*.{ts,tsx}', '--loglevel', level])
}
const eslintCommand = ['eslint', '--ext', 'tsx,ts', './src/', '--cache']

task('watch', () => series('react'))
/**
 * @cli-argument fresh {boolean} use a new profile to start over.
 */
task('watch/firefox', () => parallel('react', 'load/firefox'))
task('watch/android', () => parallel('react', 'load/firefox/android'))

task('react', () => parallel('lint/fix', 'react/start'))
task('react/start', () => step(['react-app-rewired', 'start']))
task('react/build', () => step(['react-app-rewired', 'build']))
task('react/test', () => step(['react-app-rewired', 'test']))

const prompt = () => console.log('[web-ext] assuming built, starting hot reload service')

task('load/firefox', async () => {
    if (!(await fs.pathExists(profile)) || args.fresh) {
        try {
            const timestamp = Date.now().toString()
            await step(['firefox', '-CreateProfile', `"${timestamp} ${path.join(profile, timestamp)}"`])
        } catch {
            throw new Error('Cannot locate or create a profile for firefox. Add firefox to your PATH.')
        }
        if (args.fresh) {
            console.warn('new profile generated. old firefox profile cleanable by command "firefox -P".')
        }
    }
    await fs.remove('./dist')
    await untilDirChanged('./dist')
    prompt()
    const latestProfile = path.join(profile, last(await fs.readdir(profile)))
    await step([
        'web-ext',
        'run',
        `--firefox-profile=${latestProfile}`,
        '--keep-profile-changes',
        '--source-dir',
        './dist/',
    ])
    process.exit(0)
})
task('load/firefox/android', async () => {
    await fs.remove('./dist')
    await untilDirChanged('./dist')
    prompt()
    const list = adb.listDevices()
    const device = (() => {
        if (list.length === 1) {
            return list[0]['id']
        }
        return args['android-device']
    })()
    if (device) {
        await step([
            'web-ext',
            'run',
            args.refresh ? '' : '--keep-profile-changes',
            '--target=firefox-android',
            '--source-dir',
            './dist/',
            `--android-device=${device}`,
        ])
    } else {
        throw new Error('[web-ext] no device specified, exiting')
    }
    process.exit(0)
})

task('lint', () => parallel('lint/prettier', 'lint/eslint'))
task('lint/fix', () => parallel('lint/prettier/fix', 'lint/eslint/fix'))
task('lint/prettier', () => prettierCommand('check'))
task('lint/prettier/fix', () => prettierCommand('write', 'warn'))
task('lint/eslint', () => step(eslintCommand))
task('lint/eslint/fix', () => step(eslintCommand.concat('--fix')))

task('storybook', () => parallel('lint/fix', 'storybook/serve'))
task('storybook/serve', () => step(['start-storybook', '-p', '9009', '-s', 'public', '--quiet'], { withWarn: true }))
task('storybook/build', () => step(['build-storybook', '-s', 'public', '--quiet'], { withWarn: true }))

task('install', () => series('install/holoflows'))
task('install/holoflows', async () => {
    if (args.upgrade) {
        await step(['yarn', 'upgrade', '@holoflows/kit'])
    }
    const dir = { cwd: path.join(process.cwd(), 'node_modules/@holoflows/kit') }
    await step(['yarn'], dir)
    await step(['yarn', 'build'], dir)
})

/**
 * @param cmd {string[]} The command you want to run
 * @param [opt] {import('child_process').SpawnOptions & { withWarn?: boolean }} Options
 */
const step = (cmd, opt = { withWarn: process.env.CI === 'true' }) => {
    if (!Array.isArray(cmd)) cmd = [cmd]
    const child = spawn(cmd[0], cmd.splice(1), {
        // TODO: without this things won't work but it said this option is dangerous
        shell: true,
        stdio: ['inherit', 'inherit', opt.withWarn ? 'inherit' : 'ignore'],
        ...opt,
    })

    return new Promise((resolve, reject) => {
        child.on('error', reject)

        child.on('exit', code => {
            if (code === 0) {
                resolve()
            } else {
                const err = new Error(`child exited with code ${code}`)
                reject(err)
            }
        })
    })
}

const untilDirChanged = (dir = '.', timeout = 4000) => {
    return new Promise(resolve => {
        let last = undefined
        watch(dir).on('all', () => {
            if (last) {
                clearTimeout(last)
            }
            last = setTimeout(resolve, timeout)
        })
    })
}

const last = array => {
    const length = array == null ? 0 : array.length
    return length ? array[length - 1] : undefined
}
