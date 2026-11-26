/**
 * Bootstraps the moderation classifier with labelled examples derived from the
 * bot's automod rules. There is no real moderation history in a fresh install,
 * so without these the trainer would only see the built-in CLEAN samples and
 * learn to answer "clean" to everything.
 *
 *   npm run db:seed:moderation
 *
 * Safe to re-run: it replaces its own BOOTSTRAP rows and retrains the model.
 * Real automod removals (source AUTOMOD) and manually added samples are never
 * touched.
 */
import { prisma } from "../apps/web/src/lib/prisma";
import { classify, getLatestModel, trainAndStoreModel } from "../apps/web/src/lib/moderation-model";

const SAMPLES: Array<{ label: string; content: string }> = [
  // Invite links
  { label: "INVITE", content: "join my server https://discord.gg/abc123" },
  { label: "INVITE", content: "come hang out at discord.gg/xyz789" },
  { label: "INVITE", content: "check out our community discord.me/abc12" },
  { label: "INVITE", content: "server invite discordapp.com/invite/xyz" },
  { label: "INVITE", content: "join discord.com/invite/abc123 for chat" },
  { label: "INVITE", content: "click here dsc.gg/abc123" },
  { label: "INVITE", content: "we have a gaming server discord.gg/gaming" },
  { label: "INVITE", content: "free stuff on our discord.gg/promo" },
  { label: "INVITE", content: "invite link discord.gg/12345" },
  { label: "INVITE", content: "come join us at https://discord.gg/test" },
  { label: "INVITE", content: "chat with us on discord.gg/chat" },
  { label: "INVITE", content: "join the official discord.gg/official server" },
  { label: "INVITE", content: "https://discord.gg/friends is the link" },
  { label: "INVITE", content: "my server invite is discordapp.com/invite/friends" },
  { label: "INVITE", content: "visit discord.me/community to join" },
  { label: "INVITE", content: "dsc.gg/promos has giveaways" },

  // External links
  { label: "LINK", content: "free nitro here https://bit.ly/abc123" },
  { label: "LINK", content: "visit https://example.com/promo for free stuff" },
  { label: "LINK", content: "check out http://scam-site.xyz/offer" },
  { label: "LINK", content: "get cheap followers at https://socialpromo.site" },
  { label: "LINK", content: "read more https://news.example.org/article" },
  { label: "LINK", content: "download the app from https://myapp.download" },
  { label: "LINK", content: "watch the video at https://video.example.net/watch" },
  { label: "LINK", content: "sign up at http://freerewards.invalid" },
  { label: "LINK", content: "best deals https://deals.example.shop" },
  { label: "LINK", content: "click this link https://tinyurl.com/xyz123" },
  { label: "LINK", content: "our website is https://example.site/home" },
  { label: "LINK", content: "http://example.org/promo has the details" },
  { label: "LINK", content: "get your free gift https://gift.example.com" },
  { label: "LINK", content: "see the full guide at https://guide.example.io" },
  { label: "LINK", content: "join our group at https://t.me/abc123" },
  { label: "LINK", content: "cheap coins on https://coins.example.market" },

  // Banned words (mild examples; replace with real cases as they accumulate)
  { label: "WORD", content: "you are stupid" },
  { label: "WORD", content: "that was a dumb idea" },
  { label: "WORD", content: "shut up please" },
  { label: "WORD", content: "stop being an idiot" },
  { label: "WORD", content: "what a stupid question" },
  { label: "WORD", content: "you are so dumb" },
  { label: "WORD", content: "go away idiot" },
  { label: "WORD", content: "this is stupid" },
  { label: "WORD", content: "dumbest thing ever" },
  { label: "WORD", content: "stop acting stupid" },
  { label: "WORD", content: "you idiot" },
  { label: "WORD", content: "shut up already" },
  { label: "WORD", content: "that is dumb" },
  { label: "WORD", content: "what an idiot" },

  // Excessive caps
  { label: "CAPS", content: "THIS IS ALL CAPS AND VERY LOUD" },
  { label: "CAPS", content: "BUY NOW LIMITED OFFER FREE NITRO" },
  { label: "CAPS", content: "HELLO EVERYONE PLEASE READ THIS" },
  { label: "CAPS", content: "WARNING WARNING WARNING THIS IS IMPORTANT" },
  { label: "CAPS", content: "I AM YELLING BECAUSE I CAN" },
  { label: "CAPS", content: "GET FREE COINS RIGHT NOW" },
  { label: "CAPS", content: "THIS SERVER IS THE BEST EVER" },
  { label: "CAPS", content: "STOP TALKING AND LISTEN TO ME" },
  { label: "CAPS", content: "HUGE GIVEAWAY EVERYONE JOIN NOW" },
  { label: "CAPS", content: "PLEASE HELP ME WITH MY ACCOUNT" },
  { label: "CAPS", content: "I NEED ADMIN RIGHTS RIGHT NOW" },
  { label: "CAPS", content: "THIS IS A VERY IMPORTANT ANNOUNCEMENT" },
  { label: "CAPS", content: "NOBODY IS ONLINE TODAY" },
  { label: "CAPS", content: "COME PLAY WITH US RIGHT NOW" },

  // Repeated messages
  { label: "SPAM", content: "first first first first first first" },
  { label: "SPAM", content: "hello hello hello hello hello hello" },
  { label: "SPAM", content: "buy buy buy buy buy buy buy" },
  { label: "SPAM", content: "yes yes yes yes yes yes yes" },
  { label: "SPAM", content: "@everyone @everyone @everyone @everyone" },
  { label: "SPAM", content: "join join join join join join" },
  { label: "SPAM", content: "free free free free free free" },
  { label: "SPAM", content: "test test test test test test" },
  { label: "SPAM", content: "wow wow wow wow wow wow wow" },
  { label: "SPAM", content: "same same same same same same" },
  { label: "SPAM", content: "please please please please please" },
  { label: "SPAM", content: "look look look look look look" },
  { label: "SPAM", content: "ok ok ok ok ok ok ok" },
  { label: "SPAM", content: "spam spam spam spam spam spam" },

  // Clean examples that share vocabulary with the violations above
  { label: "CLEAN", content: "join us for game night later" },
  { label: "CLEAN", content: "the server link is in the description" },
  { label: "CLEAN", content: "free pizza for everyone tonight" },
  { label: "CLEAN", content: "hello everyone, how are you?" },
  { label: "CLEAN", content: "please read the rules before joining" },
  { label: "CLEAN", content: "this is a great community" },
  { label: "CLEAN", content: "thanks for the invite to the event" },
  { label: "CLEAN", content: "buying snacks for the party" },
  { label: "CLEAN", content: "the giveaway was fun last week" },
  { label: "CLEAN", content: "our website has the schedule" },
  { label: "CLEAN", content: "watch the stream together" },
  { label: "CLEAN", content: "let us play a few games" },
  { label: "CLEAN", content: "I need help with my settings" },
  { label: "CLEAN", content: "admin is away for a bit" },
  { label: "CLEAN", content: "the announcement was clear" },
  { label: "CLEAN", content: "everyone is welcome here" },
  { label: "CLEAN", content: "check your messages please" },
  { label: "CLEAN", content: "that was a nice match" },
  { label: "CLEAN", content: "welcome to the server" },
  { label: "CLEAN", content: "the test results are in" },
  { label: "CLEAN", content: "we are looking for members" },
  { label: "CLEAN", content: "stop by the voice channel" },
  { label: "CLEAN", content: "the link works now thanks" },
  { label: "CLEAN", content: "hello, can you hear me?" },

  // Additional phrasing so the classifier does not key on a single word
  { label: "INVITE", content: "we should chat on discord.gg/chatroom sometime" },
  { label: "INVITE", content: "the discord.gg/meetup link is working now" },
  { label: "INVITE", content: "join discord.gg/study if you like studying" },
  { label: "INVITE", content: "our discord.gg/team is open to everyone" },
  { label: "INVITE", content: "dsc.gg/events has the schedule" },
  { label: "INVITE", content: "discord.me/friends is where we hang out" },
  { label: "INVITE", content: "invite: https://discord.gg/abc" },
  { label: "INVITE", content: "come to discord.gg/lounge" },

  { label: "LINK", content: "the article is on https://example.com/news" },
  { label: "LINK", content: "check https://example.net for updates" },
  { label: "LINK", content: "you can read it at http://example.org/story" },
  { label: "LINK", content: "free music at https://music.example.fm" },
  { label: "LINK", content: "the video is on https://video.example.tv" },
  { label: "LINK", content: "sign up on https://site.example.dev" },
  { label: "LINK", content: "more info here https://info.example.co" },

  { label: "WORD", content: "that is really stupid" },
  { label: "WORD", content: "dont be an idiot" },
  { label: "WORD", content: "shut up, i am busy" },
  { label: "WORD", content: "what a dumb plan" },
  { label: "WORD", content: "stop being dumb" },
  { label: "WORD", content: "idiot alert" },

  { label: "CAPS", content: "EVERYONE PLEASE JOIN THE VOICE CHANNEL" },
  { label: "CAPS", content: "THIS IS NOT A DRILL" },
  { label: "CAPS", content: "WE ARE STARTING NOW" },
  { label: "CAPS", content: "THANKS FOR ALL THE HELP" },
  { label: "CAPS", content: "I AM VERY HAPPY TODAY" },
  { label: "CAPS", content: "PLEASE SEND YOUR ANSWERS" },

  { label: "SPAM", content: "go go go go go go" },
  { label: "SPAM", content: "nice nice nice nice nice" },
  { label: "SPAM", content: "help help help help help" },
  { label: "SPAM", content: "join now join now join now" },
  { label: "SPAM", content: "free coins free coins free coins" },
  { label: "SPAM", content: "yes yes yes yes" },

  { label: "CLEAN", content: "the link to the docs is pinned" },
  { label: "CLEAN", content: "can you share the link to the server settings" },
  { label: "CLEAN", content: "free but only for members" },
  { label: "CLEAN", content: "join the voice channel when you can" },
  { label: "CLEAN", content: "we use discord for chat but no invites here" },
  { label: "CLEAN", content: "hello and welcome to the channel" },
  { label: "CLEAN", content: "test message from my phone" },
  { label: "CLEAN", content: "the test is finished" },
  { label: "CLEAN", content: "buy a ticket for the event" },
  { label: "CLEAN", content: "chat here instead of other places" },
  { label: "CLEAN", content: "this server has a rule about links" },
  { label: "CLEAN", content: "everyone please be nice" },
  { label: "CLEAN", content: "the group is full" },
  { label: "CLEAN", content: "my website has a blog" },
  { label: "CLEAN", content: "watch out for spam links" },
  { label: "CLEAN", content: "please do not spam the chat" },
  { label: "CLEAN", content: "stop posting the same thing" },
  { label: "CLEAN", content: "the caps lock key is broken" },
  { label: "CLEAN", content: "that word is not allowed here" },
  { label: "CLEAN", content: "read the announcement please" },

  // Benign phrasing that shares vocabulary with violations. Without these the
  // model learns "join" == invite and "hello hello" == clean instead of
  // keying on the marker tokens.
  { label: "CLEAN", content: "please join us after the meeting" },
  { label: "CLEAN", content: "you can join if you want to" },
  { label: "CLEAN", content: "join the call at eight" },
  { label: "CLEAN", content: "we can chat here about anything" },
  { label: "CLEAN", content: "chat here is fine with me" },
  { label: "CLEAN", content: "our website is down today" },
  { label: "CLEAN", content: "the website looks great now" },
  { label: "CLEAN", content: "our group is small but friendly" },
  { label: "CLEAN", content: "the group will start at noon" },
  { label: "CLEAN", content: "my caps lock is stuck again" },
  { label: "CLEAN", content: "the caps key on this keyboard is fine" },
  { label: "CLEAN", content: "i have been busy lately" },
  { label: "CLEAN", content: "school work is finally done" },
  { label: "CLEAN", content: "that was a fun idea" },
  { label: "CLEAN", content: "the giveaway rules are simple" },
  { label: "CLEAN", content: "free time is hard to find" },

  { label: "WORD", content: "what a dumb idea" },
  { label: "WORD", content: "that is the dumbest thing" },
  { label: "WORD", content: "dumb ideas are not welcome" },
  { label: "WORD", content: "that was a stupid idea" },
  { label: "WORD", content: "the stupidest thing i have heard" },
];

async function main(): Promise<void> {
  await prisma.moderationSample.deleteMany({ where: { source: "BOOTSTRAP" } });
  await prisma.moderationSample.createMany({
    data: SAMPLES.map((sample) => ({ ...sample, source: "BOOTSTRAP" })),
  });

  console.log(`Seeded ${SAMPLES.length} labelled examples.`);

  const result = await trainAndStoreModel("bootstrap-seed");
  const accuracy =
    result.accuracy === null ? "n/a" : `${(result.accuracy * 100).toFixed(1)}%`;
  console.log(
    `Trained: ${result.sampleCount} samples, ${result.trainCount} train / ${result.testCount} test, accuracy ${accuracy}`,
  );
  console.log("Classes:", JSON.stringify(result.labelCounts));

  const model = await getLatestModel();
  if (model) {
    for (const text of [
      "join my server discord.gg/abc123",
      "free nitro at https://bit.ly/xyz",
      "THIS IS ALL CAPS AND LOUD",
      "hey everyone how is it going",
    ]) {
      const top = classify(text, model, 1)[0];
      console.log(`  ${top?.label} (${(top?.probability * 100).toFixed(1)}%) <- ${text}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
