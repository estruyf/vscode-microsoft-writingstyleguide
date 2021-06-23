const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const cheerio = require('cheerio');
const { gzip } = require('node-gzip');
const md = require('markdown-it');

const converter = new md({ html: true, breaks: true });

const searchPath = `**/microsoft-style-guide/styleguide/a-z-word-list-term-collections/**/*.md`;
const msUrl = "https://docs.microsoft.com/en-us/style-guide";
const parts = "docs.microsoft.com/en-us/style-guide/a-z-word-list-term-collections/alpha".split('/');

const processLinks = ($, linkElms, content) => {

  const fLinks = linkElms.filter(i => !$(i).attr("href").startsWith(`http`));
  const uLinks = [...new Set(fLinks)];

  for (const link of uLinks) {
    const $link = $(link);
    const fileLink = $link.attr('href');
    let updatedLink = fileLink;

    if (updatedLink.endsWith(`.md`)) {
      updatedLink = updatedLink.substring(0, fileLink.length - 3);
    }

    if (updatedLink.startsWith(`/`)) {
      updatedLink = `${msUrl}${updatedLink}`;
    }
    
    if (updatedLink.startsWith(`~`)) {
      updatedLink = `${msUrl}${updatedLink.substring(1)}`;
    }
    
    if (updatedLink.startsWith(`../`)) {
      var count = (updatedLink.match(/\.\.\//g) || []).length;

      let newParts = Object.assign([], parts);
      newParts = newParts.slice(0, parts.length - count);
      
      updatedLink = `https://${newParts.join("/")}/${updatedLink.replace(/\.\.\//g, "")}`;
    }

    if (updatedLink) {
      content = content.replace(`(${fileLink})`, `(${updatedLink})`);
    }
  }

  return content;
};



(async () => {
  const entries = await fg([searchPath]);

  console.log(`Entries to process:`, entries.length);

  let dictionary = [];

  for (const entry of entries) {
    const filePath = path.join(__dirname, '../', entry);

    if (fs.existsSync(filePath)) {
      const contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
      const data = matter(contents);
      const htmlContent = converter.render(data.content);
      const $ = cheerio.load(htmlContent);

      const header = $('h1');
      const anchorElms = $(`a`).toArray();

      if (header.length > 0) {
        const words = header.first().text().split(',').map(w => w.toLowerCase().trim());

        let content = data.content;

        if (anchorElms && anchorElms.length > 0) {
          content = processLinks($, anchorElms, content);
        }

        dictionary.push({
          words,
          content
        });
      }
    }
  }

  fs.writeFileSync(path.join(__dirname, '../dictionary.json'), JSON.stringify(dictionary), { encoding: "utf-8" });
})();