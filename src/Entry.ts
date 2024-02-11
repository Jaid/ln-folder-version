import os from 'node:os'

import fs from 'fs-extra'
import globby from 'globby'
import * as lodash from 'lodash-es'

import path from '~/lib/mixedPath.js'

export type Options = {
  output: string
  roots: string[]
  versionGlob: string
}

type ProcessResult = {
  linkTarget: string
  status: "new" | "skip" | "update"
  version: string
  versionFolder: string
}

export class Entry {
  output: string
  roots: string[]
  versionGlob: string
  constructor(options: Options) {
    this.roots = lodash.castArray(options.roots)
    this.output = options.output ?? path.join(os.homedir(), `.config`, process.env.npm_package_name!, `links`, `{{basename}}`)
    this.versionGlob = options.versionGlob ?? `*`
  }
  async processLink(rootFolder: string): Promise<ProcessResult> {
    const versionFolderStats = await globby(this.versionGlob, {
      cwd: rootFolder,
      expandDirectories: false,
      fs,
      objectMode: true,
      onlyDirectories: true,
      stats: true,
    })
    const result: Partial<ProcessResult> = {
      status: `new`,
    }
    result.version = lodash.maxBy(versionFolderStats, `stats.birthtime`)!.name
    result.versionFolder = path.resolve(rootFolder, result.version)
    result.linkTarget = this.output.replaceAll(`{{basename}}`, path.basename(rootFolder)).replaceAll(`{{version}}`, result.version)
    if (await fs.pathExists(result.linkTarget)) {
      const currentLink = await fs.readlink(result.linkTarget)
      if (path.normalize(currentLink) === path.normalize(result.versionFolder)) {
        result.status = `skip`
        return <ProcessResult> result
      }
      console.log(`Current link target: %s`, currentLink)
      console.log(`Removing existing link target: %s`, result.linkTarget)
      await fs.remove(result.linkTarget)
      result.status = `update`
    }
    const linkTargetParentFolder = path.dirname(result.linkTarget)
    await fs.ensureDir(linkTargetParentFolder)
    await fs.symlink(result.versionFolder, result.linkTarget, `dir`)
    return <ProcessResult> result
  }
  async run() {
    const rootFolders: string[] = []
    for (const root of this.roots) {
      const matches = await globby(root, {
        expandDirectories: false,
        fs,
        onlyDirectories: true,
      })
      rootFolders.push(...matches)
    }
    for (const rootFolder of rootFolders) {
      console.log(`⁃ ${rootFolder}`)
      try {
        const result = await this.processLink(rootFolder)
        console.log(`  [%s] %s ← %s`, result.status, result.versionFolder, result.linkTarget)
      } catch (error) {
        console.error(error)
      }
    }
  }
}
