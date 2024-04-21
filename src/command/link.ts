import * as path from 'forward-slash-path'
import type {Options} from '../Entry.js'
import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import os from 'node:os'

import fs from 'fs-extra'
import * as lodash from 'lodash-es'
import readFileYaml from 'read-file-yaml'

import {Entry} from '../Entry.js'

// Don’t fully understand this, taken from here: https://github.com/zwade/hypatia/blob/a4f2f5785c146b4cb4ebff44da609a6500c53887/backend/src/start.ts#L47
export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

export const command = `$0 link`
export const describe = `Update links based on given config`
export const builder = (argv: Argv) => {
  return argv
    .options({
      configFile: {
        default: path.join(os.homedir(), `.config`, process.env.npm_package_name!, `config.yml`),
        required: true,
        string: true,
      },
    })
}

export const handler = async (args: Args) => {
  console.dir(args)
  const configFileExists = await fs.pathExists(args.configFile)
  if (!configFileExists) {
    await fs.ensureFile(args.configFile)
    console.log(`Created config file at ${args.configFile}`)
    return
  }
  const config = <Options[]> await readFileYaml.default(args.configFile)
  const entries = config.map(entry => new Entry(entry))
  for (const entry of entries) {
    await entry.run()
  }
}
