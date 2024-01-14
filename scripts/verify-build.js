/*
 * ToDo: write simple script to verify if a build is correctly attributed to the commit hash specifited both in the
 * index.js file and in the comment of the specified commit.
 * 
 * 1. Runs the script with "build commit" hash: `node scripts/verify-build.js <build commit hash>`
 * 2. The script then verifies the build & commit using the following steps:
 *     a. `git checkout` into the "build commit" hash
 *     b. Generate a hash of all the contents of the built `dist` directory
 *     c. Grab the hash of the "source commit" from the comment of the "build commit" (use `git log -1`)
 *     d. `git checkout` into the "source commit"
 *     e. Run `npm run build` to build the dist directory for the "source commit"
 *     f. Add the script/text for the commit hash in the `dist/index.html` (or text) file
 *     g. Generate a hash of `dist` directory using exactly the same algorithm in (b)
 *     h. If both the hashes do not match, the test is unsuccessful!
 */
