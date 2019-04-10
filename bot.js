const config = require("./.config.js");
const libfb = require("libfb");
const fs = require("fs");

(async () => {
  let bot;
  try {
    // Login
    bot = await libfb.login(
      config.facebook_username,
      config.facebook_password,
      {
        selfListen: true,
        // Read session if exists
        session: fs.existsSync(__dirname + "/.appstate.json")
          ? JSON.parse(fs.readFileSync(__dirname + "/.appstate.json", "utf8"))
          : undefined
      }
    );
  } catch (err) {
    // Login errors
    let error_title = err.errorData.error_title;
    let error_message = err.errorData.error_message;
    console.error(`Error: ${error_title} - "${error_message}"`);
    process.exit(1);
  }

  // Store session
  fs.writeFileSync(
    __dirname + "/.appstate.json",
    JSON.stringify(bot.getSession())
  );

  bot.id = bot.session.tokens.uid;
  bot.admins = config.bot_admins;
  bot.command_prefix = config.bot_command_prefix;

  let _commandNames = ["help", "wake-on-lan", "rng", "info", "paiza.io", "lmgtfy", "life360"];
  let commands = {};
  for (let command of _commandNames) {
    commands[command] = require(`./commands/${command}`)(bot);
    if (typeof commands[command].name === "string") {
      commands[command].name = Array(commands[command].name);
    }
  }
  bot.commands = commands;

  let commandMap = {};
  for (let command in commands) {
    for (let name of commands[command].name) {
      commandMap[name.toLowerCase()] = commands[command];
    }
  }
  bot.commandMap = commandMap;

  bot.on("message", async message => {
    // {
    //     threadId: int,
    //     attachments: array,
    //     authorId: int,
    //     id: str',
    //     timestamp: epoch,
    //     message: str,
    //     stickerId: int
    // }

    // Check if the message starts with the command prefix
    if (!message.message.startsWith(config.bot_command_prefix)) return;

    // Break down
    let tokens = message.message.split(" ");
    let commandStr = tokens[0]
      .toLowerCase()
      .replace(config.bot_command_prefix.toLowerCase(), "");

    // Check of the command exists
    if (commandStr in commandMap) {
      // Check if the user has permission to run the command
      if (
        commandMap[commandStr].admin &&
        bot.admins.indexOf(message.authorId) == -1
      ) {
        bot.sendMessage(
          message.threadId,
          "Error: You do not have permission to execute this command!"
        );
        console.info(`${message.authorId} tried to execute \`${commandStr}\``);
        return;
      }

      // Try run the command
      try {
        let response = await commandMap[commandStr].function(
          message,
          tokens.slice(1).join(" ")
        );
        if (response) {
          bot.sendMessage(message.threadId, response);
        }
        // Catch exception messages
      } catch (err) {
        bot.sendMessage(message.threadId, `${err}`);
      }
    } else {
      // Command not found!!
    }
  });

  console.info("Loading complete");
})();