// ==========================================================
// Sender Auditor v1.0
// Author: Ernesto Mwangi
// Terminal Edition
// ==========================================================

const axios = require("axios");
const cheerio = require("cheerio");
const chalk = require("chalk");
const ora = require("ora");
const { performance } = require("perf_hooks");

//===========================================================
// CONFIG
//===========================================================

const TARGET = "https://aquatools.io";

//===========================================================
// GLOBAL REPORT OBJECT
//===========================================================

const report = {
    target: TARGET,
    status: "",
    responseTime: "",
    server: "",
    contentType: "",
    https: false,
    htmlSize: 0,

    title: "",
    description: "",
    language: "",

    links: [],
    internalLinks: [],
    externalLinks: [],
    images: [],
    scripts: [],
    stylesheets: [],
    headings: [],

    emails: [],
    phones: [],

    robots: false,
    sitemap: false
};

//===========================================================
// UI
//===========================================================

function line() {
    console.log(chalk.gray("===================================================="));
}

function section(title) {
    console.log();
    console.log(chalk.cyan.bold(title));
    console.log(chalk.gray("--------------------------------------------"));
}

function success(msg) {
    console.log(chalk.green("✓ " + msg));
}

function warning(msg) {
    console.log(chalk.yellow("! " + msg));
}

function error(msg) {
    console.log(chalk.red("✗ " + msg));
}

//===========================================================
// FETCH PAGE
//===========================================================

async function fetchPage(url) {

    const spinner = ora("Connecting...").start();

    try {

        const start = performance.now();

        const response = await axios.get(url, {

            timeout: 15000,

            headers: {

                "User-Agent":
                    "SenderAuditor/1.0 (+https://your-domain.com)"

            }

        });

        const end = performance.now();

        spinner.succeed("Connected");

        report.status = response.status;
        report.responseTime = `${Math.round(end - start)} ms`;

        report.server =
            response.headers.server || "Unknown";

        report.contentType =
            response.headers["content-type"] || "Unknown";

        report.https = url.startsWith("https://");

        report.htmlSize =
            Buffer.byteLength(response.data, "utf8");

        return response.data;

    } catch (err) {

        spinner.fail("Connection failed");

        throw err;

    }

}

//===========================================================
// PARSE HTML
//===========================================================

function parseHTML(html) {

    const $ = cheerio.load(html);

    report.title = $("title").text().trim();

    report.description =
        $('meta[name="description"]').attr("content") || "";

    report.language =
        $("html").attr("lang") || "Unknown";

    $("h1").each((i, el) => {

        report.headings.push($(el).text().trim());

    });

    $("img").each((i, el) => {

        const src = $(el).attr("src");

        if (src)
            report.images.push(src);

    });

    $("script").each((i, el) => {

        const src = $(el).attr("src");

        if (src)
            report.scripts.push(src);

    });

    $('link[rel="stylesheet"]').each((i, el) => {

        const href = $(el).attr("href");

        if (href)
            report.stylesheets.push(href);

    });

    $("a").each((i, el) => {

        const href = $(el).attr("href");

        if (!href)
            return;

        report.links.push(href);

        if (
            href.startsWith("http") &&
            !href.includes(new URL(TARGET).hostname)
        ) {

            report.externalLinks.push(href);

        } else {

            report.internalLinks.push(href);

        }

    });

}

//===========================================================
// EXTRACT EMAILS
//===========================================================

function extractEmails(html) {

    const regex =
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

    const found = html.match(regex);

    if (!found)
        return;

    report.emails = [...new Set(found)];

}

//===========================================================
// EXTRACT PHONES
//===========================================================

function extractPhones(html) {

    const regex =
        /(\+?\d[\d\s\-()]{7,}\d)/g;

    const found = html.match(regex);

    if (!found)
        return;

    report.phones = [...new Set(found)];

}

//===========================================================
// CHECK ROBOTS
//===========================================================

async function checkRobots() {

    try {

        const url =
            new URL("/robots.txt", TARGET).href;

        const response = await axios.get(url);

        report.robots =
            response.status === 200;

    } catch {

        report.robots = false;

    }

}

//===========================================================
// CHECK SITEMAP
//===========================================================

async function checkSitemap() {

    try {

        const url =
            new URL("/sitemap.xml", TARGET).href;

        const response = await axios.get(url);

        report.sitemap =
            response.status === 200;

    } catch {

        report.sitemap = false;

    }

}



//===========================================================
// PRINT REPORT
//===========================================================

function printReport() {

    console.clear();

    line();
    console.log(chalk.green.bold("          SENDER AUDITOR v1.0"));
    line();

    console.log(chalk.white("Target           :"), report.target);
    console.log(chalk.white("Status           :"), report.status);
    console.log(chalk.white("HTTPS            :"), report.https ? "Yes" : "No");
    console.log(chalk.white("Response Time    :"), report.responseTime);
    console.log(chalk.white("Server           :"), report.server);
    console.log(chalk.white("Content Type     :"), report.contentType);
    console.log(chalk.white("HTML Size        :"), report.htmlSize + " bytes");

    section("PAGE INFORMATION");

    console.log("Title            :", report.title || "None");
    console.log("Language         :", report.language);
    console.log("Description      :", report.description || "None");

    section("HEADINGS");

    if (report.headings.length === 0) {
        warning("No H1 headings found.");
    } else {
        report.headings.forEach((heading, index) => {
            console.log(`H1 ${index + 1}: ${heading}`);
        });
    }

    section("STATISTICS");

    console.log("Links            :", report.links.length);
    console.log("Internal Links   :", report.internalLinks.length);
    console.log("External Links   :", report.externalLinks.length);
    console.log("Images           :", report.images.length);
    console.log("Scripts          :", report.scripts.length);
    console.log("Stylesheets      :", report.stylesheets.length);

    section("EMAILS");

    if (report.emails.length === 0) {
        warning("No email addresses found.");
    } else {
        report.emails.forEach(email => console.log("•", email));
    }

    section("PHONE NUMBERS");

    if (report.phones.length === 0) {
        warning("No phone numbers found.");
    } else {
        report.phones.forEach(phone => console.log("•", phone));
    }

    section("FILES");

    console.log(
        "robots.txt       :",
        report.robots
            ? chalk.green("FOUND")
            : chalk.red("NOT FOUND")
    );

    console.log(
        "sitemap.xml      :",
        report.sitemap
            ? chalk.green("FOUND")
            : chalk.red("NOT FOUND")
    );

    section("LINK PREVIEW");

    if (report.links.length === 0) {

        warning("No links found.");

    } else {

        report.links.slice(0, 20).forEach((link, i) => {
            console.log(`${i + 1}. ${link}`);
        });

        if (report.links.length > 20) {
            console.log(
                chalk.yellow(
                    `...and ${report.links.length - 20} more`
                )
            );
        }

    }

    line();
    success("Audit Completed Successfully");
    line();
}

//===========================================================
// MAIN
//===========================================================

async function main() {

    try {

        line();
        console.log(chalk.green.bold("Starting Sender Auditor"));
        line();

        const html = await fetchPage(TARGET);

        parseHTML(html);

        extractEmails(html);

        extractPhones(html);

        await checkRobots();

        await checkSitemap();

        printReport();

    } catch (err) {

        error("Audit Failed");

        console.log();

        console.log(
            chalk.red(err.message)
        );

    }

}

//===========================================================
// START
//===========================================================

main();
