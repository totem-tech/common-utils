/**
 * Build and push only the build files to branch named "[branch-name]-build"
 * 
 * @description
 * @param {String} push     (optional) '1' = true, anything else means build & commit only but do not push.
 *                          Default: '1'
 * @param {String} distDir  (optional) directory where built files will be stored.
 *                          Typically this directory should be ignored by the "source" branch.
 *                          Default: 'dist'
 * @param {String} buildBranchSuffix (optional) branch name suffix to create/use as the "build" branch.
 *                          If the "source" branch name is 'master' and suffix is '-build',
 *                          the "build" branch name will be "master-build".
 *                          NB: use of "-" or "_" as a separator is recommended to distinguish between branch names.
 *                          Default: '-build'
 *
 * @example ```bash
 * # Run the buld file using CLI from source branch
 *
 * # build,commit and push to remote repo
 * node src/utils/scripts/build.js 1
 *
 *
 * # build and commit but do not push
 * node src/utils/scripts/build.js 0
 * 
 * # specify build branch name prefix and dist directory
 * node src/utils/scripts/build.js 0 my-dist-directory -my-build-suffix
 * ```
 * 
 * 
 * ToDo: zip/compress dist directory to reduce Git history size??
 */
const { execSync: xs } = require('child_process')
const fs = require('fs')

const execSync = (cmd, ...args) => {
    console.log(`>> Executing: ${cmd}\n`)
    return xs(cmd, ...args)
}
const push = ([...process.argv][2] || '1') === '1'
const distDir = [...process.argv][3] || 'dist'
let buildBranchSuffix = [...process.argv][4] || '-build'

const getBranch = () => execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .split('\n')[0]

const getCommitHash = () => execSync('git log -1')
    .toString()
    .split('\n')[0]
    .split('commit')[1]
    .trim()

const run = async () => {
    // extract branch name
    let result
    const cleanupCmds = []
    const branchName = getBranch()
    console.log('Branch Name:', branchName)
    if (branchName.endsWith(buildBranchSuffix)) return console.error(
        'Please run this script from a branch that does not end with',
        buildBranchSuffix
    )

    // make sure all changes are commited
    result = execSync('git status')
    const containsChanges = !result
        .toString()
        .includes('nothing to commit')
    if (containsChanges) return console.error('Please make sure to there are no uncommited changes.')

    // get current commit
    const commitHash = getCommitHash()
    if (!commitHash) console.log('Create a commit first')
    const buildBranch = `${branchName}${buildBranchSuffix}`

    // build current commit (assumes `distDir` directory is either ignored or accepted in the original branch)
    console.log('Clean Build => branch:', branchName, '| commit hash:', commitHash)
    execSync(`rm -rf ${distDir}`)
    execSync('npm run build')

    const tempPath = '~/temp'
    const tempDistPath = `${tempPath}/${commitHash}`
    console.log(`Copying build files to temp directory: ${distDir} >> ${tempDistPath}`)
    execSync(`mkdir -p ${tempPath} && rm -rf ${tempDistPath}`)
    execSync(`cp -rf ${distDir} ${tempDistPath}`)

    cleanupCmds.push(`rm -rf ${tempDistPath}`)
    let exists
    try {
        exists = execSync(`git branch --contains ${buildBranch}`)
            .toString()
            .split('\n')[0]
            ?.trim() === buildBranch
    } catch (_) { }

    if (!exists) {
        // Switch to the very first commit so that the "dist" directory can be included 
        const firstCommit = execSync('git rev-list --max-parents=0 HEAD')
            .toString()
            .split('\n')[0]
        console.log('Switching to the very first commit')
        execSync(`git checkout ${firstCommit}`)
    }

    try {
        // checkout the build branch
        exists
            ? console.log('Switching to', buildBranch)
            : console.log('Creating build branch: ' + buildBranch)
        execSync(`git switch ${!exists ? '-c ' : ''}${buildBranch}`)
        // make sure it has switched to the build branch
        if (getBranch() !== buildBranch) return console.error('Failed to switch to build branch! Reason unknown!')

        // check if the commit has already been built
        result = execSync('git log -1')
        const lastBuiltCommit = result
            .toString()
            .split('\n')
            .filter(x => x.includes('Build for '))[0]
            ?.split('Build for ')[1]
            ?.split(' ')?.[0]
        const isBuilt = commitHash === lastBuiltCommit
        if (isBuilt && !push) throw new Error('This build has already been committed!')

        if (!isBuilt) {
            const distPath = `${distDir}${distDir.endsWith('/') ? '' : '/'}`
            console.log(`Copying dist files to project directory: ${tempDistPath} >> ${distDir}`)
            execSync(`rm -rf ${distPath} && cp -rf ${tempDistPath} ${distPath}`)

            const htmlPath = `${distPath}index.html`
            const txtPath = `${distPath}commit-hash.txt`
            const indexExists = fs.existsSync(htmlPath)
            console.log('Adding commit hash to  ', indexExists ? htmlPath : txtPath)
            if (indexExists) {
                execSync(`echo '<script>window.commitHash="${commitHash}";</script>' >> ${htmlPath}`)
            } else {
                execSync(`echo "${commitHash}" > ${txtPath}`)
                cleanupCmds.push(`rm ${txtPath}`)
            }

            console.log('Creating a commit with the current build')
            execSync(`git add ${distDir}`) // add all changes
            execSync(`git commit -m "Build for ${commitHash}"`)
        }

        if (push) {
            console.log('Pushing commit...')
            try {
                execSync('git push')
            } catch (err) {
                execSync(`git push --set-upstream origin ${buildBranch}`)
            }
        }

        console.log('All done!')
        cleanupCmds.push(`rm -rf ${tempPath}`)
    } catch (err) {
        console.log('\n==== Error Message Start =====')
        console.error(err)
        console.log('==== Error Message End =====\n')
    } finally {
        // restore all changes from the build branch
        console.log('Cleanup')
        for (let i = 0;i < cleanupCmds.length;i++) {
            execSync(cleanupCmds[i])
        }

        // switch back to original branch
        console.log('Switching back to original branch')
        execSync(`git switch ${branchName}`)
    }
}
run()