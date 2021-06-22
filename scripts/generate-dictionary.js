const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const cheerio = require('cheerio');
const { gzip } = require('node-gzip');
const MarkdownIt = require('markdown-it');
const striptags = require('striptags');

const md = new MarkdownIt();

const searchPath = `**/microsoft-style-guide/styleguide/a-z-word-list-term-collections/**/*.md`;

(async () => {
  const entries = await fg([searchPath]);

  console.log(`Entries to process:`, entries.length);

  let dictionary = [];

  for (const entry of entries) {
    const filePath = path.join(__dirname, '../', entry);

    if (fs.existsSync(filePath)) {
      const contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
      const data = matter(contents);
      const htmlContent = md.render(data.content);
      const $ = cheerio.load(htmlContent);

      const header = $('h1');

      if (header.length > 0) {
        const words = header.first().text().split(',').map(w => w.toLowerCase().trim());

        // const htmlContent = $.html();
        // let content = htmlContent.trim();

        // const lt = new RegExp(`&lt;`, "g");
        // content = content.replace(lt, "<");

        // const gt = new RegExp(`&gt;`, "g");
        // content = content.replace(gt, ">");

        // const amp = new RegExp(`&amp;`, "g");
        // content = content.replace(amp, "&");

        // content = striptags(content);

        // content = content.replace(/\n/g, `\n\n`);
        // content = content.replace(/\n\n\n\n/g, `\n\n`);

        // while (content.endsWith(`\n`)) {
        //   content = content.substring(0, content.length - 2);
        // }

        dictionary.push({
          words,
          content: data.content
        });
      }
    }
  }

  fs.writeFileSync(path.join(__dirname, '../dictionary.json'), JSON.stringify(dictionary), { encoding: "utf-8" });
})();