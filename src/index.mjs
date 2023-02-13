import puppeteer from "puppeteer";

const log = console.log;

const TARGET = "https://crm.metriks.ru/shahmatki/agent";

const TIMEOUT = 1000 * 60;

const run = async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();

  await page.setViewport({ width: 2000, height: 1024 });

  await page.goto(TARGET);

  /* const complexes = await page.$$eval(".main__item", (els) => els.map((v) => v)); */

  log("Generating complex details: name, homes[links]");
  const complexes = await page.evaluate(() => {
    const container_class = ".main__item";

    return Array.from(document.querySelectorAll(container_class)).map((el) => ({
      id: "",
      name: el.querySelector(`${container_class + "-top"} ${container_class + "-name"}`).textContent,
      buildings_details: Array.from(el.querySelectorAll("a")).map((anchor) => ({ link: anchor.href, name: anchor.innerText, id: "" })),
    }));
  });

  const _complexes = [];

  log("Looping through complexes");
  for (let { name: complex_name, buildings_details, id: complex_id } of complexes) {
    const _buildings = [];

    log("Working on complex %s", complex_name);
    for (let { link, name, id } of buildings_details) {
      await page.goto(link);

      log("[LOADING PAGE] %s", link);

      const entrance_selectors = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".chess__porch-item")).map((e) => `${".chess__porch-item"}[data-id="${e.dataset.id}"]`);
      });

      const _apartments = [];

      log("Working on a single entrance in %s", name);
      for (let _selector of entrance_selectors) {
        try {
          // prettier-ignore
          /* const [response] =  */ await Promise.all([
          page.waitForNavigation({waitUntil: 'networkidle0', timeout: TIMEOUT}),
          page.click(_selector),
          /* page.waitForSelector(".chess__item.white", { timeout: TIMEOUT }) */
        ]);
        } catch (e) {
          log(e);
          process.exit(0);
        }

        const apartments_selectors = await page.evaluate(() => {
          return Array.from(document.querySelectorAll(".chess__item.white")).map((e) => `${".chess__item.white"}[data-id="${e.dataset.id}"]`);
        });

        log("Collecting apartments in the current entrance");
        for (let apartment_selector of apartments_selectors) {
          try {
            // prettier-ignore
            /* const [response] =  */ await Promise.all([
            page.waitForNavigation({waitUntil: 'networkidle0', timeout: TIMEOUT}),
            page.click(apartment_selector),
            /* page.waitForSelector("#change-popup", { timeout: TIMEOUT }) */
          ]);
          } catch (e) {
            log(e);
            process.exit(0);
          }

          const apartment = await page.evaluate(() => ({
            is_apartment: document.getElementById("VIEW-TYPETEXT").innerText === "Квартира",
            num: document.getElementById("VIEW-NUM").innerText,
            count_rooms: document.getElementById("VIEW-ROOM").innerText,
            total_area: document.getElementById("VIEW-AREA").innerText,
            living_area: document.getElementById("VIEW-LIVING_AREA").innerText,
            kitchen_area: document.getElementById("VIEW-CITCHEN_AREA").innerText,
            layout_plan: document.querySelector(".layout__img img").src,
            deadline: document.getElementById("VIEW-CONSTRUCTION_YEAR").innerText,
            floor: document.getElementById("VIEW-FLOOR").innerText,
          }));

          log("---------------------------------------------------------------------------------------------------------------------------");
          log(apartment);
          log("---------------------------------------------------------------------------------------------------------------------------");

          /* process.exit(1); */

          apartment.is_apartment && _apartments.push(apartment);

          await page.click(".edit__close");

          /* await page.screenshot({ path: "screen.png", fullPage: true }); */
        }
      }

      _buildings.push({
        apartments: _apartments,
        name,
        id,
      });
    }

    _complexes.push({
      id: complex_id,
      name: complex_name,
      buildings: _buildings,
    });
  }

  log(_complexes);

  await browser.close();
};

run();
