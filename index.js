const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ]
});

// --- CONFIGURATION CONSTANTS ---
const EMBED_COLOR = '#3498DB'; // Light blue NYPD theme color
const TARGET_GUILD_ID = '1451392079702786073'; // NYPD Server ID
const BOT_TOKEN = process.env.BOT_TOKEN;

// Application Log Channel & Banner
const STAFF_APP_LOG_CHANNEL = '1451975746536083536';
const BANNER_IMAGE_URL = 'https://media.discordapp.net/attachments/1372189296886476905/1385765000307482654/rm.png';

// Officer Roles & Config
const STAFF_TRAINEE_ROLE = '1536803826412290138';
const OFFICIAL_STAFF_ROLE = '1451392080269283392';
const ALLOWED_STAFF_ROLES = [
    '1536803826412290138',
    '1451392080269283392'
];

// Detective Restrictions & Config
const BLOCKED_DETECTIVE_ROLE = '1451392079702786079';

// Trackers
const activeOfficerApplications = new Map();
const activeDetectiveApplications = new Map();

client.on('ready', async () => {
    console.log(`[NYPD Bot] Logged in as ${client.user.tag}! Both Application systems online.`);

    const commands = [
        {
            name: 'officersetup',
            description: 'Posts the NYPD Officer Applications Panel.'
        },
        {
            name: 'detectivesetup',
            description: 'Posts the NYPD Detective Applications Panel.'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, TARGET_GUILD_ID),
            { body: commands },
        );
    } catch (error) {
        console.error(error);
    }
});

// --- GLOBAL MESSAGE LISTENER FOR DM APPLICATIONS ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (message.guild) return; // Only process DMs

    // Check Officer Session
    const officerSession = activeOfficerApplications.get(message.author.id);
    if (officerSession && officerSession.active) {
        if (officerSession.timeoutTimer) clearTimeout(officerSession.timeoutTimer);
        officerSession.answers.push(message.content);
        officerSession.step++;

        if (officerSession.step < officerQuestions.length) {
            await askNextOfficerQuestion(message.author);
        } else {
            await sendFinalOfficerPrompt(message.author);
        }
        return;
    }

    // Check Detective Session
    const detectiveSession = activeDetectiveApplications.get(message.author.id);
    if (detectiveSession && detectiveSession.active) {
        if (detectiveSession.timeoutTimer) clearTimeout(detectiveSession.timeoutTimer);
        detectiveSession.answers.push(message.content);
        detectiveSession.step++;

        if (detectiveSession.step < detectiveQuestions.length) {
            await askNextDetectiveQuestion(message.author);
        } else {
            await sendFinalDetectivePrompt(message.author);
        }
        return;
    }
});

// --- SLASH COMMAND SETUP ROUTER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'officersetup') {
        await interaction.deferReply({ ephemeral: true });

        const appRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_staff_app')
                .setLabel('NYPD Officer Application')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ components: [appRow] });
        await interaction.editReply({ content: 'NYPD Officer Applications button deployed successfully!' });
    }

    if (interaction.commandName === 'detectivesetup') {
        await interaction.deferReply({ ephemeral: true });

        const detectiveRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_detective_app')
                .setLabel('NYPD Detective Application')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ components: [detectiveRow] });
        await interaction.editReply({ content: 'NYPD Detective Applications button deployed successfully!' });
    }
});

// --- INTERACTION & APPLICATION HANDLER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    // --- OFFICER APPLICATION FLOW ---
    if (interaction.customId === 'open_staff_app') {
        if (activeOfficerApplications.has(interaction.user.id) || activeDetectiveApplications.has(interaction.user.id)) {
            return interaction.reply({ 
                content: 'You already have an active application process ongoing in your direct messages. Please check your DMs.', 
                ephemeral: true 
            });
        }

        const appIntroEmbed = new EmbedBuilder()
            .setTitle('New York Police Department Officer Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription('Please click below to begin your officer application session.');

        const startRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_app_process')
                .setLabel('Start Application')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_app_final')
                .setLabel('Cancel Application')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            await interaction.user.send({ embeds: [appIntroEmbed], components: [startRow] });
            activeOfficerApplications.set(interaction.user.id, { step: 0, answers: [], active: false });
            await interaction.reply({ content: `<@${interaction.user.id}>, your NYPD officer application portal has been sent to your DMs!`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: 'Failed to send you a direct message. Please ensure your DMs are open and try again.', ephemeral: true });
        }
    }

    if (interaction.customId === 'start_app_process') {
        const session = activeOfficerApplications.get(interaction.user.id);
        if (session) session.active = true;
        await interaction.update({ content: 'Application process started! Please answer the question sent below in normal text.', components: [] }).catch(() => {});
        askNextOfficerQuestion(interaction.user);
    }

    if (interaction.customId === 'submit_app_final') {
        const session = activeOfficerApplications.get(interaction.user.id);
        if (session && session.timeoutTimer) clearTimeout(session.timeoutTimer);
        await interaction.update({ content: 'Your application has been successfully completed and submitted to the New York Police Department Management Team for review!', components: [] }).catch(() => {});
        finalizeOfficerSubmission(interaction.user);
        return;
    }

    if (interaction.customId === 'cancel_app_final') {
        const session = activeOfficerApplications.get(interaction.user.id);
        if (session && session.timeoutTimer) clearTimeout(session.timeoutTimer);
        activeOfficerApplications.delete(interaction.user.id);
        await interaction.update({ content: 'Your application process has been cancelled.', components: [] }).catch(() => {});
        return;
    }

    // --- DETECTIVE APPLICATION FLOW ---
    if (interaction.customId === 'open_detective_app') {
        // Check if user has the blacklisted/blocked role ID
        if (interaction.member && interaction.member.roles.cache.has(BLOCKED_DETECTIVE_ROLE)) {
            return interaction.reply({ 
                content: 'You are restricted from submitting a detective application due to your roles.', 
                ephemeral: true 
            });
        }

        if (activeOfficerApplications.has(interaction.user.id) || activeDetectiveApplications.has(interaction.user.id)) {
            return interaction.reply({ 
                content: 'You already have an active application process ongoing in your direct messages. Please check your DMs.', 
                ephemeral: true 
            });
        }

        const detectiveIntroEmbed = new EmbedBuilder()
            .setTitle('New York Police Department Detective Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription('Please click below to begin your detective application session.');

        const startDetectiveRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('start_detective_process')
                .setLabel('Start Detective Application')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('cancel_detective_final')
                .setLabel('Cancel Application')
                .setStyle(ButtonStyle.Danger)
        );

        try {
            await interaction.user.send({ embeds: [detectiveIntroEmbed], components: [startDetectiveRow] });
            activeDetectiveApplications.set(interaction.user.id, { step: 0, answers: [], active: false });
            await interaction.reply({ content: `<@${interaction.user.id}>, your NYPD detective application portal has been sent to your DMs!`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: 'Failed to send you a direct message. Please ensure your DMs are open and try again.', ephemeral: true });
        }
    }

    if (interaction.customId === 'start_detective_process') {
        const session = activeDetectiveApplications.get(interaction.user.id);
        if (session) session.active = true;
        await interaction.update({ content: 'Detective application process started! Please answer the question sent below.', components: [] }).catch(() => {});
        askNextDetectiveQuestion(interaction.user);
    }

    if (interaction.customId === 'submit_detective_final') {
        const session = activeDetectiveApplications.get(interaction.user.id);
        if (session && session.timeoutTimer) clearTimeout(session.timeoutTimer);
        await interaction.update({ content: 'Your detective application has been successfully submitted!', components: [] }).catch(() => {});
        finalizeDetectiveSubmission(interaction.user);
        return;
    }

    if (interaction.customId === 'cancel_detective_final') {
        const session = activeDetectiveApplications.get(interaction.user.id);
        if (session && session.timeoutTimer) clearTimeout(session.timeoutTimer);
        activeDetectiveApplications.delete(interaction.user.id);
        await interaction.update({ content: 'Your detective application process has been cancelled.', components: [] }).catch(() => {});
        return;
    }

    // --- STAFF REVIEW HANDLERS (Accept / Decline) ---
    if (interaction.customId.startsWith('accept_app_') || interaction.customId.startsWith('decline_app_')) {
        const staffMember = interaction.member;
        if (!staffMember) {
            return interaction.reply({ content: 'Could not verify your membership status in the main server.', ephemeral: true });
        }
        const hasAllowedRole = staffMember.roles.cache.some(r => ALLOWED_STAFF_ROLES.includes(r.id));
        if (!hasAllowedRole) {
            return interaction.reply({ content: 'Only authorized staff members can review applications.', ephemeral: true });
        }

        await interaction.deferUpdate().catch(() => {});

        const targetUserId = interaction.customId.split('_')[2];
        const actionType = interaction.customId.startsWith('accept_app_') ? 'accept' : 'decline';
        const guild = interaction.guild;

        let targetMember;
        try {
            targetMember = await guild.members.fetch(targetUserId);
        } catch (e) {
            targetMember = null;
        }

        if (actionType === 'accept') {
            if (targetMember) {
                try {
                    await targetMember.roles.add([STAFF_TRAINEE_ROLE, OFFICIAL_STAFF_ROLE]);
                } catch (err) {
                    console.error('Failed to assign staff roles:', err);
                }

                const acceptDmEmbed = new EmbedBuilder()
                    .setTitle('NYPD Application Accepted')
                    .setColor('#2ECC71')
                    .setImage(BANNER_IMAGE_URL)
                    .setDescription('Your application has been **accepted**! You have been granted the required roles.');

                await targetMember.send({ embeds: [acceptDmEmbed] }).catch(() => {});
            }

            const transcriptBuffer = interaction.message.attachments.first() ? (await (await fetch(interaction.message.attachments.first().url)).arrayBuffer()) : Buffer.from('Transcript unavailable', 'utf-8');
            const transcriptAttachment = { attachment: Buffer.from(transcriptBuffer), name: `application-${targetUserId}.txt` };

            await interaction.message.channel.send({
                content: `Application for <@${targetUserId}> has been **ACCEPTED** by <@${interaction.user.id}>.`,
                files: [transcriptAttachment]
            });

            try { await interaction.message.delete(); } catch (e) {}

        } else {
            if (targetMember) {
                const declineDmEmbed = new EmbedBuilder()
                    .setTitle('NYPD Application Update')
                    .setColor('#E74C3C')
                    .setImage(BANNER_IMAGE_URL)
                    .setDescription('We regret to inform you that your application has been declined after careful review.');

                await targetMember.send({ embeds: [declineDmEmbed] }).catch(() => {});
            }

            const transcriptBuffer = interaction.message.attachments.first() ? (await (await fetch(interaction.message.attachments.first().url)).arrayBuffer()) : Buffer.from('Transcript unavailable', 'utf-8');
            const transcriptAttachment = { attachment: Buffer.from(transcriptBuffer), name: `application-${targetUserId}.txt` };

            await interaction.message.channel.send({
                content: `Application for <@${targetUserId}> has been **DECLINED** by <@${interaction.user.id}>.`,
                files: [transcriptAttachment]
            });

            try { await interaction.message.delete(); } catch (e) {}
        }
    }
});

// --- QUESTIONNAIRES ---
const officerQuestions = [
    "State your Roblox Username.",
    "State your age.",
    "Do you have previous law enforcement experience? If yes, what was your highest rank?",
    "Why do you want to become a New York City Police Officer?",
    "What can you contribute to the New York Police Department?"
];

const detectiveQuestions = [
    "1. Why do you want to become an NYPD Detective? (Explain your interest in investigations)",
    "2. What investigative skills do you currently have? (Examples: observation, interviewing, report writing.)",
    "3. Describe a time you analyzed information to solve a problem.",
    "4. How would you handle conflicting witness statements? (Explain how you would verify facts)",
    "5. What steps would you take when collecting and protecting evidence? (Explain proper evidence handling)"
];

// --- OFFICER FUNCTIONS ---
async function askNextOfficerQuestion(user) {
    const session = activeOfficerApplications.get(user.id);
    if (!session) return;

    if (session.step < officerQuestions.length) {
        const questionText = officerQuestions[session.step];
        const questionEmbed = new EmbedBuilder()
            .setTitle(`Officer Application - Question ${session.step + 1} of ${officerQuestions.length}`)
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription(`> ${questionText}`);

        session.lastQuestionMessage = await user.send({ embeds: [questionEmbed] });
        session.timeoutTimer = setTimeout(() => {
            if (activeOfficerApplications.has(user.id)) {
                user.send('Your application session has timed out due to inactivity.');
                activeOfficerApplications.delete(user.id);
            }
        }, 1200000);
    }
}

async function sendFinalOfficerPrompt(user) {
    const session = activeOfficerApplications.get(user.id);
    if (!session) return;

    const finalEmbed = new EmbedBuilder()
        .setTitle('Officer Application Review')
        .setColor(EMBED_COLOR)
        .setImage(BANNER_IMAGE_URL)
        .setDescription('> Click below to finalize and submit your Officer application.');

    const submitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('submit_app_final').setLabel('Submit Application').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_app_final').setLabel('Cancel Application').setStyle(ButtonStyle.Danger)
    );

    await user.send({ embeds: [finalEmbed], components: [submitRow] });
}

async function finalizeOfficerSubmission(user) {
    const session = activeOfficerApplications.get(user.id);
    if (!session) return;

    const logChannel = client.channels.cache.get(STAFF_APP_LOG_CHANNEL);
    if (logChannel) {
        let transcriptString = `=== NYPD - OFFICER APPLICATION TRANSCRIPT ===\nApplicant: ${user.tag} (${user.id})\n\n`;
        for (let i = 0; i < officerQuestions.length; i++) {
            transcriptString += `[Q${i + 1}]: ${officerQuestions[i]}\n[Answer]: ${session.answers[i] || 'No response'}\n\n`;
        }

        const transcriptBuffer = Buffer.from(transcriptString, 'utf-8');
        const transcriptAttachment = { attachment: transcriptBuffer, name: `officer-app-${user.id}.txt` };

        const logEmbed = new EmbedBuilder()
            .setTitle('NYPD Officer Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL);

        for (let i = 0; i < officerQuestions.length; i++) {
            logEmbed.addFields({ name: `${i + 1}. ${officerQuestions[i]}`, value: `> ${session.answers[i] || 'No response'}`, inline: false });
        }

        const reviewRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_app_${user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_app_${user.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
        );

        await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [reviewRow] }).catch(err => console.error(err));
    }

    activeOfficerApplications.delete(user.id);
}

// --- DETECTIVE FUNCTIONS ---
async function askNextDetectiveQuestion(user) {
    const session = activeDetectiveApplications.get(user.id);
    if (!session) return;

    if (session.step < detectiveQuestions.length) {
        const questionText = detectiveQuestions[session.step];
        const questionEmbed = new EmbedBuilder()
            .setTitle(`Detective Application - Question ${session.step + 1} of ${detectiveQuestions.length}`)
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription(`> ${questionText}`);

        session.lastQuestionMessage = await user.send({ embeds: [questionEmbed] });
        session.timeoutTimer = setTimeout(() => {
            if (activeDetectiveApplications.has(user.id)) {
                user.send('Your detective application session has timed out due to inactivity.');
                activeDetectiveApplications.delete(user.id);
            }
        }, 1200000);
    }
}

async function sendFinalDetectivePrompt(user) {
    const session = activeDetectiveApplications.get(user.id);
    if (!session) return;

    const finalEmbed = new EmbedBuilder()
        .setTitle('Detective Application Review')
        .setColor(EMBED_COLOR)
        .setImage(BANNER_IMAGE_URL)
        .setDescription('> Click below to finalize and submit your Detective application.');

    const submitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('submit_detective_final').setLabel('Submit Application').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_detective_final').setLabel('Cancel Application').setStyle(ButtonStyle.Danger)
    );

    await user.send({ embeds: [finalEmbed], components: [submitRow] });
}

async function finalizeDetectiveSubmission(user) {
    const session = activeDetectiveApplications.get(user.id);
    if (!session) return;

    const logChannel = client.channels.cache.get(STAFF_APP_LOG_CHANNEL);
    if (logChannel) {
        let transcriptString = `=== NYPD - DETECTIVE APPLICATION TRANSCRIPT ===\nApplicant: ${user.tag} (${user.id})\n\n`;
        for (let i = 0; i < detectiveQuestions.length; i++) {
            transcriptString += `[Q${i + 1}]: ${detectiveQuestions[i]}\n[Answer]: ${session.answers[i] || 'No response'}\n\n`;
        }

        const transcriptBuffer = Buffer.from(transcriptString, 'utf-8');
        const transcriptAttachment = { attachment: transcriptBuffer, name: `detective-app-${user.id}.txt` };

        const logEmbed = new EmbedBuilder()
            .setTitle('NYPD Detective Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL);

        for (let i = 0; i < detectiveQuestions.length; i++) {
            logEmbed.addFields({ name: `${i + 1}. ${detectiveQuestions[i]}`, value: `> ${session.answers[i] || 'No response'}`, inline: false });
        }

        const reviewRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_app_${user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_app_${user.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
        );

        await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [reviewRow] }).catch(err => console.error(err));
    }

    activeDetectiveApplications.delete(user.id);
}

client.login(BOT_TOKEN);
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});