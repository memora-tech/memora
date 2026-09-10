import { createApp } from './app.js'
import { createStore } from './store.js'

const port = Number(process.env.PORT || 3180)
const store = createStore()
const app = createApp(store)

app.listen(port, () => {
  process.stdout.write(`Memora API mock em http://localhost:${port}/v1\n`)
})
