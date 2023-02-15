import puppeteer from "puppeteer";
import crypto from "crypto-js";
import convert from "xml-js";
import trans from "cyrillic-to-translit-js";
import fs from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = console.log;

const log_block = (...args) => {
  log("////////////////////////////////////////////////////////////////////////////////////////////////////");
  log("////////////////////////////////////////////////////////////////////////////////////////////////////");
  log("//////////", ...args);
  log("////////////////////////////////////////////////////////////////////////////////////////////////////");
  log("////////////////////////////////////////////////////////////////////////////////////////////////////\n");
};

const TARGET = "https://crm.metriks.ru/shahmatki/agent";

const APARTMENT_END_POINT = "https://crm.metriks.ru/local/components/itiso/shahmatki.lists/ajax.php";

const TIMEOUT = 1000 * 60;

const now = () => (Date.now() / 1000).toFixed(0);

const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve(void 0), ms));

const writeXML = (complexes) => {
  let result = convert.js2xml({ complexes }, { compact: true, ignoreComment: true, spaces: 4 });

  // prettier-ignore
  fs.writeFileSync(
      __dirname + '/../xml/metrics:' + trans().transform(complexes.complex.name, '-').toLowerCase() + '.xml',
      '<?xml version="1.0" encoding="UTF-8" ?>\n' + result,
      { flag: 'wx' }
  );
};

const getApartmentData = async (id) => {
  try {
    const response = await fetch(APARTMENT_END_POINT, {
      method: "POST",
      body: JSON.stringify({
        action: "getObjectById",
        id: parseInt(id),
      }),
    });

    const v = await response.text();

    console.log(v);

    if (!response.ok) {
      console.log("STATUS: ", response.status);
      throw Error("Something went wrong");
    }

    const data = await response.json();

    const apartment = data?.NUM;
    const is_apartment = data?.TYPETEXT === "Квартира";
    const rooms = data?.ROOM;
    const area = data?.AREA;
    const plan = data?.LAYOUT?.ORIGINAL_SRC;

    return {
      is_apartment,
      apartment,
      rooms,
      area,
      plan,
    };
  } catch (e) {
    log_block(e);

    return {
      is_apartment: false,
    };
  }
};

const run = async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.setViewport({ width: 2000, height: 1024 });

  await page.goto(TARGET);

  /* const complexes = await page.$$eval(".main__item", (els) => els.map((v) => v)); */

  log("Generating complex details: name, homes_links");

  const complexes_meta = await page.evaluate(() => {
    const container_class = ".main__item";
    return Array.from(document.querySelectorAll(container_class)).map((el) => ({
      name: el.querySelector(`${container_class + "-top"} ${container_class + "-name"}`).textContent,
      buildings_details: Array.from(el.querySelectorAll("a")).map((anchor) => ({
        name: anchor.innerText,
        link: anchor.href,
      })),
    }));
  });

  for (let { name: complex_name, buildings_details } of complexes_meta) {
    const _buildings = [];

    log_block("[Working on complex] %s", complex_name);

    for (let { link, name } of buildings_details) {
      log_block("[Working building] %s", name);

      await page.goto(link);

      log("[LOADING BUILDING] %s", link);

      const entrance_selectors = await page.evaluate(() => {
        const _selector = ".chess__porch-item";
        return Array.from(document.querySelectorAll(_selector)).map((e) => `${_selector}[data-id="${e.dataset.id}"]`);
      });

      const _flats = [];

      for (let _selector of entrance_selectors) {
        // prettier-ignore
        /* const [response] = */ await Promise.all([
            page.waitForNavigation({waitUntil: 'networkidle0', timeout: TIMEOUT}),
            page.click(_selector),
          ]);

        const apartments_IDS = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".chess__href:has(> .white)")).map((a) => {
            return new URL(a.href).searchParams.get("id");
          });
        });

        for (let apartment_id of apartments_IDS) {
          const flat = await getApartmentData(apartment_id);

          if (!flat.is_apartment) continue;

          delete flat.is_apartment;
          _flats.push(flat);
        }

        log_block(apartments_IDS);
      }

      _buildings.push({
        id: crypto.MD5(name).toString(),
        name,
        flats: {
          flat: _flats,
        },
      });
    }

    writeXML({
      _attributes: {
        timestamp: now(),
      },
      complex: {
        id: crypto.MD5(complex_name).toString(),
        name: complex_name,
        buildings: { building: _buildings },
      },
    });

    log_block("[Working On Complex Finished] %s", complex_name);
  }

  await browser.close();
};

run();
