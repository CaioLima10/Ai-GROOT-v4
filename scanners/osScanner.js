import os from "os"

export function systemInfo() {

  return {

    platform: os.platform(),
    arch: os.arch(),
    memory: os.totalmem(),
    node: process.version

  }

}