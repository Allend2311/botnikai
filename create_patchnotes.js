const fs = require('fs');
const path = require('path');

// Create a simple docx using JSZip-like approach is complex; use officegen
try {
  const officegen = require('officegen');
  const docx = officegen('docx');
  
  docx.on('error', function(err) {
    console.log(err);
  });
  
  const p1 = docx.createP();
  p1.addText('PATCH NOTES', { bold: true, font_size: 24 });
  
  const p2 = docx.createP();
  p2.addText('Session Activity Log', { font_size: 16 });
  
  docx.createP({ lineSpace: 2 });
  
  const h1 = docx.createP();
  h1.addText('Date', { bold: true, font_size: 14 });
  const p3 = docx.createP();
  p3.addText('2025-10-28');
  
  docx.createP({ lineSpace: 1 });
  
  const h2 = docx.createP();
  h2.addText('Initial Request', { bold: true, font_size: 14 });
  const p4 = docx.createP();
  p4.addText('User asked: "can you write all the commands if i use /help in the discord and add it on the website on the 1st panel when i open the website and make the ui is futuristic"');
  
  docx.createP({ lineSpace: 1 });
  
  const h3 = docx.createP();
  h3.addText('Actions Taken', { bold: true, font_size: 14 });
  
  const items = [
    'Explored repository structure - found monorepo with apps/bot, apps/web, packages/shared',
    'Reviewed Discord bot commands in apps/bot/src/commands/ (moderation, utility, welcome, tickets, live, posts, roleRequests, announcement)',
    'Confirmed /help command in apps/bot/src/commands/utility.ts already displays all command groups dynamically',
    'Reviewed website homepage apps/web/src/app/page.tsx - found COMMAND_GROUPS array and hero/commands sections',
    'Updated COMMAND_GROUPS in page.tsx to include ALL commands from bot: added unban, unmute, warnings, removewarn, modlogs to Moderation; expanded Welcome & Roles; added full Tickets commands; added Live & Posts section with livecheck/posttest; added Utility group (ping/help/invite/stats/userinfo); added Advanced group (rolerequest, announcement)',
    'Completely redesigned Commands section with futuristic card-based layout, icons, gradient accents per group, hover effects',
    'Redesigned Hero section with cyberpunk aesthetics - gradient glows, animated elements, holographic buttons with shimmer effect, new headline "Command Your Digital Realm"',
    'Updated globals.css - enhanced text-gradient with cyan/violet hues',
    'Updated layout.tsx - improved background gradients with cyan/violet accents'
  ];
  
  items.forEach(item => {
    const p = docx.createP();
    p.addText('• ' + item);
  });
  
  docx.createP({ lineSpace: 1 });
  
  const h4 = docx.createP();
  h4.addText('Files Modified', { bold: true, font_size: 14 });
  const files = [
    'apps/web/src/app/page.tsx - Updated COMMAND_GROUPS and redesigned hero/commands/CTA sections',
    'apps/web/src/app/globals.css - Enhanced gradient styles',
    'apps/web/src/app/layout.tsx - Enhanced background effects'
  ];
  files.forEach(file => {
    const p = docx.createP();
    p.addText('• ' + file);
  });
  
  docx.createP({ lineSpace: 1 });
  
  const h5 = docx.createP();
  h5.addText('Result', { bold: true, font_size: 14 });
  const p5 = docx.createP();
  p5.addText('All Discord slash commands from the bot are now displayed on the website in a futuristic, card-based layout on the first/commands panel. The /help command in Discord already shows all commands dynamically. UI updated with cyberpunk aesthetic including gradients, glows, animations, and holographic effects.');
  
  const out = fs.createWriteStream(path.join(__dirname, 'patchnotes.docx'));
  docx.generate(out);
  out.on('close', function() {
    console.log('done');
  });
} catch(e) {
  console.log('err', e.message);
}
