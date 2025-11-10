import { parseHTML } from "linkedom";
import { DateTime } from "luxon";
import overrides from "./overrides.json";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as ics from "ics";

console.log("Generating...");

const getFlagEmoji = countryCode => String.fromCodePoint(...[...countryCode.toUpperCase()].map(x => 0x1f1a5+x.charCodeAt()));
const html = await fetch("https://eurovisionworld.com/eurovision/calendar").then(response => response.text());
console.log("- Fetched HTML");
const { document } = parseHTML(html);

let events = [];

// this is jank
const showPages = JSON.parse(Array.from(document.querySelectorAll("script:not(:empty)")).filter(el => el.innerText.includes("cal_obj"))[0].innerHTML.replace(/.*cal_obj = /g, "").replace(/};.*/g, "}"));

for (const month of document.querySelectorAll(".calendar_table tbody[data-cal-month]")) {
    console.log(`\n- Generating events for ${month.dataset.calMonth}...`);
    month.querySelectorAll(".condensed, .r325i, .r325ib, .r325b, .r365i, .r365ib, .r365b, .r380i, .r380ib, .r380b, .r420i, .r420ib, .r420b, .r500i, .r500ib, .r500b, .r600i, .r600ib, .r600b, .r700i, .r700ib, .r700b, .r800i, .r800ib, .r800b, .r820i, .r820ib, .r820b, .r850i, .r850ib, .r850b, .r900i, .r900ib, .r900b, .r1000i, .r1000ib, .r1000b, .r1100i, .r1100ib, .r1100b, .r1250i, .r1250ib, .r1250b, .abc, small").forEach(el => el.remove());
    for (const event of month.querySelectorAll("tr[data-cal-id]")) {
        if (event.nextElementSibling && event.nextElementSibling.querySelectorAll("td")[0].innerHTML === "") event.nextElementSibling.querySelectorAll("td")[0].innerHTML = event.querySelectorAll("td")[0].innerHTML;
        if (event.querySelectorAll("td")[0].innerText != "—") {
            let title = "";
            if (event.querySelectorAll("td")[1].innerHTML != "" && event.querySelector("td[data-cal-c]")) title += `${getFlagEmoji(event.querySelector("td[data-cal-c]").dataset.calC)} ${event.querySelectorAll("td")[1].innerText} | `;
            if (event.querySelector(".cal_time")) {
                event.dataset.time = event.querySelector(".cal_time").dataset.tzUnix;
                event.querySelector(".cal_time").remove();
            };
            title += event.querySelectorAll("td")[2].innerText.trim();

            let categories = ["Eurovision"];
            if (event.querySelector(".fl_ebu")) categories.push("EBU Event");
            const startDate = DateTime.fromFormat(`${month.dataset.calMonth}-${event.querySelectorAll("td")[0].innerText.padStart(2, "0")}`, "yyyy-MM-dd");
            const startTime = DateTime.fromSeconds(parseInt(event.dataset.time));

            let description = [];
            let htmlContent = [];
            if (!startTime.hour && !overrides[event.dataset.calId]?.start) {
                description.push("⚠️ WARNING: This event's start time is unknown!");
                htmlContent.push("<b>⚠️ WARNING</b>: This event's start time is unknown!");
            };
            if (showPages[event.dataset.calId]?.s && event.querySelector("td[data-cal-c]")) {
                const livestreams = await fetch(`https://eurovisionworld.com/scripts/get/?livestream=${event.dataset.calId}`)
                    .then(response => response.json());

                if (livestreams.livestream) {
                    categories.push("National Final");
                    if (!event.querySelector(".cal_c_bold")) categories.push("Semi-final");

                    description.push(`📺 Watch through the broadcaster's official channel(s):
${livestreams.livestream.map(el => el.url).join("\n")}

🌐 Or, without geoblocking, on YouTube and Twitch, on ESC Fent Live:
https://youtube.com/@ESCFentLive (w/ all additional feeds!)
https://twitch.tv/ESCFentLive`);
                    htmlContent.push(`📺 Watch through the broadcaster's official channel(s):<br>${livestreams.livestream.map(el => `<a href="${el.url}" target="_blank">${el.url}</a>`).join("<br>")}<br><br>🌐 Or, without geoblocking, on YouTube and Twitch, on ESC Fent Live:<br>https://youtube.com/@ESCFentLive (w/ all additional feeds!)<br>https://twitch.tv/ESCFentLive`);
                };
            };
            if (event.querySelector(".cal_c_bold")) {
                title += " (FINAL)";
                categories.push("Final");
            };

            let url = "https://eurovisionworld.com";
            let showEventInfo = [];
            let showEventInfoHTML = [];
            if (showPages[event.dataset.calId]?.i && showPages[event.dataset.calId].i[0]) {
                url = new URL(showPages[event.dataset.calId].i[0], "https://eurovisionworld.com").href;
                showEventInfo.push(`ℹ️ More info about this show: ${url}`);
                showEventInfoHTML.push(`ℹ️ More info about this show: <a href="${url}" target="_blank">${url}</a>`);
            };
            if (showPages[event.dataset.calId]?.l && showPages[event.dataset.calId].l[0]) {
                url = new URL(showPages[event.dataset.calId].l[0], "https://eurovisionworld.com").href;
                showEventInfo.push(`📅 More info about this event: ${url}`);
                showEventInfoHTML.push(`📅 More info about this event: <a href="${url}" target="_blank">${url}</a>`);
            };
            showEventInfo.reverse();
            showEventInfoHTML.reverse();
            description.push(showEventInfo.join("\n"));
            htmlContent.push(showEventInfoHTML.join("<br>"));

            description = description.join("\n\n");
            htmlContent = `<!DOCTYPE html><html><body><p>${htmlContent.join("<br><br>")}</p></body></html>`;

            let location = "";
            if (event.querySelector("[data-cal-c]")) {
                location = event.querySelector("[data-cal-c]").innerText;
            };

            let override = {};
            if (overrides[event.dataset.calId]) override = overrides[event.dataset.calId];

            events.push({
                productId: "-//Eurovision Calendar (powered by Eurovisionworld.com)//NONSGML Eurovision Calendar (powered by Eurovisionworld.com)//EN",
                calName: "Eurovision Calendar (powered by Eurovisionworld.com)",
                title,
                uid: `${event.dataset.calId}@eurovisioncalendar`,
                url,
                categories,
                description,
                htmlContent,
                location,
                start: [startDate.year, startDate.month, startDate.day, startTime.hour ? startTime.hour : 20, startTime.minute ? startTime.minute : 0],
                end: [startDate.year, startDate.month, startDate.day, startTime.hour ? startTime.hour : 20, startTime.minute ? startTime.minute : 0],
                busyStatus: "FREE",
                transp: "TRANSPARENT",
                classification: "PUBLIC",
                ...override
            });
            console.log(`-- ${title} [${startDate.toFormat("dd/MM/yyyy")}]`);
        };
    };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await fs.writeFile(path.join(__dirname, "docs/index.ics"), ics.createEvents(events).value.replaceAll("X-WR-CALNAME:Eurovision Calendar (powered by Eurovisionworld.com)",
`NAME:Eurovision Calendar (powered by Eurovisionworld.com)
X-WR-CALNAME:Eurovision Calendar (powered by Eurovisionworld.com)
DESCRIPTION:A calendar with every Eurovision Song Contest related event. 
    Made by ESC Fent thanks to the great work of Eurovisionworld.com.
X-WR-CALDESC:A calendar with every Eurovision Song Contest related event. 
    Made by ESC Fent thanks to the great work of Eurovisionworld.com.`));

console.log("\n✅  All done!")