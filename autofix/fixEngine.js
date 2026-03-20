import { exec } from "child_process"

export function runFix(command) {

  exec(command, (err, out) => {

    if (err) {
      console.log("Erro:", err)
    }

    console.log(out)

  })

}