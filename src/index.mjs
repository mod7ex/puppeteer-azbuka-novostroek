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
  log(".................................................................................................../");
  log(".................................................................................................../");
  log("..........", ...args);
  log(".................................................................................................../");
  log(".................................................................................................../\n");
};

const TARGET = "https://crm.metriks.ru/shahmatki/agent";

const exploit = (v) => {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    const id_el = document.createElement("input");
    const action_el = document.createElement("input");
    form.method = "POST";
    form.action = "/local/components/itiso/shahmatki.lists/ajax.php";
    id_el.value = v;
    id_el.name = "id";
    form.appendChild(id_el);
    action_el.value = "getObjectById";
    action_el.name = "action";
    form.appendChild(action_el);

    var xhttp = new XMLHttpRequest();

    xhttp.open("POST", "/local/components/itiso/shahmatki.lists/ajax.php");

    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) resolve(xhttp.responseText);
    };

    xhttp.send(new FormData(form));
  });
};

const getApartmentData = (payload) => {
  return {
    is_apartment: payload?.TYPETEXT === "Квартира",
    apartment: payload?.NUM,
    rooms: payload?.ROOM,
    area: payload?.AREA,
    plan: new URL(payload?.LAYOUT?.ORIGINAL_SRC, "https://crm.metriks.ru").href,
    price: payload?.PRICE,
  };
};

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
      log_block("[Working building] %s", name);

      const apartment_selector = ".chess__href:has(> .white)";

      await Promise.all([page.goto(link), page.waitForSelector(apartment_selector)]);

      log("[LOADING BUILDING] %s", link);

      const apartments_IDS = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(apartment_selector)).map((a) => {
          return new URL(a.href).searchParams.get("id");
        });
      });

      /* console.log(apartments_IDS); */

      await page.addScriptTag({ content: `${exploit}` }); // add the exploit function to the dom so that it can be defined when evaluating

      const _flats = [];

      for (let apartment_id of apartments_IDS) {
        const apartment_details = await page.evaluate((t) => exploit(t), apartment_id);

        const flat = getApartmentData(apartment_details);

        if (!flat.is_apartment) continue;

        delete flat.is_apartment;

        _flats.push(flat);
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
