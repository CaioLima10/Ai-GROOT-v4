import fs from "fs"

export function scanProject() {

  const files = fs.readdirSync("./")

  return files

}