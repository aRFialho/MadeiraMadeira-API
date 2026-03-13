const createApp = require("./app");
const env = require("./config/env");

const app = createApp();

const publicRoutes = require("./routes/public.routes");
app.use(publicRoutes);

app.listen(env.PORT, () => {
  console.log(`[server] listening on port ${env.PORT}`);
});
