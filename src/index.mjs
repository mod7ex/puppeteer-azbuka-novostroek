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
      log_block("[Working building] in %s", name);

      await page.goto(link);

      log("[LOADING BUILDING] %s", link);

      const entrance_selectors = await page.evaluate(() => {
        const _selector = ".chess__porch-item";
        return Array.from(document.querySelectorAll(_selector)).map((e) => `${_selector}[data-id="${e.dataset.id}"]`);
      });

      const _flats = [];

      for (let _selector of entrance_selectors) {
        try {
          // prettier-ignore
          /* const [response] =  */ await Promise.all([
          page.waitForNavigation({waitUntil: 'networkidle0', timeout: TIMEOUT}),
          page.click(_selector),
        ]);

          const apartments_links = await page.evaluate(() => Array.from(document.querySelectorAll(".chess__href:has(> .white)")).map((a) => a.href));

          log("[Collecting apartments] in the current entrance");
          for (let apartment_link of apartments_links) {
            await page.goto(apartment_link);

            await page.waitForNavigation({ waitUntil: "networkidle0", timeout: TIMEOUT });

            /* await sleep(1000); */

            try {
              /* await page.screenshot({ path: "screen.png", fullPage: true }); */
              /* process.exit(1); */

              const flat = await page.evaluate(() => {
                return {
                  apartment: document.getElementById("VIEW-NUM")?.innerText,
                  is_apartment: document.getElementById("VIEW-TYPETEXT")?.innerText === "Квартира",
                  count_rooms: document.getElementById("VIEW-ROOM")?.innerText,
                  total_area: document.getElementById("VIEW-AREA")?.innerText,
                  living_area: document.getElementById("VIEW-LIVING_AREA")?.innerText,
                  kitchen_area: document.getElementById("VIEW-CITCHEN_AREA")?.innerText,
                  layout_plan: document.querySelector(".layout__img img")?.src,
                  deadline: document.getElementById("VIEW-CONSTRUCTION_YEAR")?.innerText,
                  floor: document.getElementById("VIEW-FLOOR")?.innerText,
                };
              });

              if (flat.is_apartment) {
                delete flat.is_apartment;
                _flats.push(flat);
              }

              log("Apartment %s extracted", flat.apartment);
            } catch (error) {
              log("Could not work on apartment %s", apartment_link);
              log_block("[ERROR]: ", error?.message);
              continue;
            } finally {
              await page.click(".edit__close");
            }
          }
        } catch (error) {
          log("Could not work on entrance %s", _selector);
          log_block("[ERROR]: ", error?.message);
          continue;
        }
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
