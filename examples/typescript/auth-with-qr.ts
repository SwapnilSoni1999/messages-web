import { MessagesClient } from "../../index"
import fs from "fs"

const isCredentialsFileExists = false // fs.existsSync("credentials.json")

const client = new MessagesClient({
  headless: false,
  credentials: isCredentialsFileExists
    ? JSON.parse(fs.readFileSync("credentials.json", "utf8"))
    : null,
})

client.on("credentials", (credentials) => {
  fs.writeFileSync("credentials.json", JSON.stringify(credentials, null, 2))
})

client.on("authenticated", async (service) => {
  await service.sendMessage("+91999999999", "Test message from Nodejs!")
})
