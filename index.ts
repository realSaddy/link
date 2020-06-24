import {
  Application,
  HttpException,
} from "https://deno.land/x/abc@v1.0.0-rc10/mod.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.8.0/mod.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = config();
const client = new MongoClient();
const app = new Application();

await client.connectWithUri(
  `mongodb://${env.DB_USER}:${env.DB_PASS}@${env.DB_HOST}:27017/${env.DB_DB}`,
);

interface LinkSchema {
  _id: { $oid: string };
  link: string;
  short: string;
}

const db = client.database(env.DB_DB || "link");
// @ts-ignore
const links = db.collection<LinkSchema>("links");
const letters = /^[A-Za-z]+$/;
const url = new RegExp(
  "^(https?:\\/\\/)?" +
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|" +
    "((\\d{1,3}\\.){3}\\d{1,3}))" +
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" +
    "(\\?[;&a-z\\d%_.~+=-]*)?" +
    "(\\#[-a-z\\d_]*)?$",
  "i",
);

app
  .get("/", (c) => {
    return c.file("index.html");
  })
  .get("/favicon.ico", () => {
    throw new HttpException("None", 404);
  })
  .get("*", async (c) => {
    let find = await links.findOne({
      "short": c.path.substr(1),
    });
    if (find === null) {
      throw new HttpException("Short not found", 400);
    }
    return c.redirect(find.link);
  })
  .post("/api/create", async (c) => {
    let { link, short } = await c.body();
    if (link === undefined) {
      throw new HttpException("No link provided", 400);
    } else if (short === undefined) {
      throw new HttpException("No short provided", 400);
    } else if (short.length < 2) {
      throw new HttpException("Short too short (min 2)", 400);
    } else if (short.length > 56) {
      throw new HttpException("Short too long (max 56)", 400);
    } else if (!short.match(letters)) {
      throw new HttpException("You may only use letters", 400);
    } else if (!link.match(url)) {
      throw new HttpException("Invalid URL", 400);
    } else if (await links.findOne({ short: short }) !== null) {
      throw new HttpException("Short already taken", 400);
    }
    await links.insertOne({
      "link": link,
      "short": short,
    });
    return { "success": true, "short": short };
  })
  .start({ port: 8662 });
