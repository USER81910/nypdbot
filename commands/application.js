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
// Application Log Channel
const STAFF_APP_LOG_CHANNEL = '1451975746536083536';

// Roles to give upon acceptance
const STAFF_TRAINEE_ROLE = '1536803826412290138';
const OFFICIAL_STAFF_ROLE = '1451392080269283392';

// Roles permitted to review / use staff commands
const ALLOWED_STAFF_ROLES = [
    '1536803826412290138',
    '1451392080269283392'
];

// Banner image direct URL
const BANNER_IMAGE_URL = 'https://media.discordapp.net/attachments/1372189296886476905/1385765000307482654/rm.png';

// Temporary active application sessions tracker
const activeApplications = new Map();

client.on('ready', async () => {
    console.log(`[NYPD Bot] Logged in as ${client.user.tag}! Application systems online.`);

    const commands = [
        {
            name: 'applicationsetup',
            description: 'Posts the NYPD Applications Panel.'
        },
        {
            name: 'sendappembed',
            description: 'Sends the official NYPD application panel message.'
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

    const session = activeApplications.get(message.author.id);
    if (!session || !session.active) return;

    if (session.timeoutTimer) clearTimeout(session.timeoutTimer);

    session.answers.push(message.content);
    session.step++;

    if (session.step < applicationQuestions.length) {
        await askNextQuestion(message.author);
    } else {
        await sendFinalSubmissionPrompt(message.author);
    }
});

// --- SLASH COMMAND SETUP ROUTER ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'applicationsetup') {
        await interaction.deferReply({ ephemeral: true });

        const appRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('open_staff_app')
                .setLabel('NYPD Officer Application')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ components: [appRow] });
        await interaction.editReply({ content: 'NYPD Applications button deployed successfully!' });
    }

    if (interaction.commandName === 'sendappembed') {
        if (!interaction.member.roles.cache.some(r => ALLOWED_STAFF_ROLES.includes(r.id))) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await interaction.channel.send({
                components: [
                    {
                        type: 17,
                        accent_color: 3452411,
                        components: [
                            {
                                type: 12,
                                items: [
                                    {
                                        media: {
                                            url: "https://cdn.discordapp.com/attachments/1372193627438055464/1534245043622379591/IMG_3967.png?ex=6a7a040b&is=6a78b28b&hm=51b696d668fc9427233ac2e8afe0ae48d8af83d5530ec996a5d60cf62530a58e",
                                            attachment_id: "1534245031232274442"
                                        }
                                    }
                                ]
                            },
                            {
                                type: 14,
                                divider: true,
                                spacing: 1
                            },
                            {
                                type: 10,
                                content: "**New York Police Department - Applications**\n\n> Applications are open to members who feel they have the maturity, activity, communication skills, and commitment needed to take on a staff position. Please take your time when completing your application and make sure your answers are honest, detailed, and genuinely reflect why you would be a good addition to the team.\n\n**Application Requirements**\n\n• Must be 13 years of age or older.\n• Must be an active member of the community.\n• Must have a basic understanding of grammar\n• Must remain respectful to all members and staff.\n• Must be able to handle reports and situations fairly.\n• Must meet the weekly activity requirements."
                            }
                        ]
                    }
                ],
                flags: 32768
            });

            await interaction.editReply({ content: 'NYPD Application embed sent successfully!' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Failed to send embed. Check console for details.' });
        }
    }
});

// --- INTERACTION & APPLICATION HANDLER ---
client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'open_staff_app') {
        if (activeApplications.has(interaction.user.id)) {
            return interaction.reply({ 
                content: 'You already have an active application process ongoing in your direct messages. Please check your DMs.', 
                ephemeral: true 
            });
        }

        const appIntroEmbed = new EmbedBuilder()
            .setTitle('New York Police Department Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription(
                '> **Application Requirements & Guidelines**\n\n' +
                '• Must be 13 years of age or older.\n' +
                '• Must possess a professional standard of grammar and clear communication.\n' +
                '• Must remain respectful and unbiased toward all community members and staff.\n' +
                '• Must be capable of handling conflict resolution fairly and maturely.\n\n' +
                'Please click below to begin your application session.'
            );

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
            activeApplications.set(interaction.user.id, { step: 0, answers: [], active: false });
            await interaction.reply({ content: `<@${interaction.user.id}>, your NYPD officer application portal has been sent to your DMs!`, ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: 'Failed to send you a direct message. Please ensure your DMs are open and try again.', ephemeral: true });
        }
    }

    if (interaction.isButton() && interaction.customId === 'start_app_process') {
        const session = activeApplications.get(interaction.user.id);
        if (session) {
            session.active = true;
        }
        await interaction.update({ content: 'Application process started! Please answer the question sent below in normal text.', components: [] }).catch(() => {});
        askNextQuestion(interaction.user);
    }

    if (interaction.isButton() && interaction.customId === 'submit_app_final') {
        const session = activeApplications.get(interaction.user.id);
        if (session) {
            if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
        }
        await interaction.update({ content: 'Your application has been successfully completed and submitted to the New York Police Department Management Team for review!', components: [] }).catch(() => {});
        finalizeApplicationSubmission(interaction.user);
        return;
    }

    if (interaction.isButton() && interaction.customId === 'cancel_app_final') {
        const session = activeApplications.get(interaction.user.id);
        if (session && session.timeoutTimer) {
            clearTimeout(session.timeoutTimer);
        }
        activeApplications.delete(interaction.user.id);
        await interaction.update({ content: 'Your application process has been cancelled.', components: [] }).catch(() => {});
        return;
    }

    if (interaction.isButton() && (interaction.customId.startsWith('accept_app_') || interaction.customId.startsWith('decline_app_'))) {
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
                    .setTitle('NYPD Officer Application Accepted')
                    .setColor('#2ECC71')
                    .setImage(BANNER_IMAGE_URL)
                    .setDescription(
                        '> Dear **' + targetMember.user.username + '**,\n\n' +
                        'We are pleased to formally inform you that your officer application for **New York Police Department (NYPD)** has been thoroughly reviewed and **accepted** by our administrative division.\n\n' +
                        '• **Processed & Accepted By:** ' + interaction.user.tag + '\n' +
                        '• **Assigned Roles:** Staff Trainee & Official Staff\n\n' +
                        'You have successfully been granted the required role within the main server. Welcome to the department!'
                    )
                    .setFooter({ text: 'New York Police Department Management Division' })
                    .setTimestamp();

                await targetMember.send({ embeds: [acceptDmEmbed] }).catch(() => {});
            }

            const transcriptBuffer = interaction.message.attachments.first() ? (await (await fetch(interaction.message.attachments.first().url)).arrayBuffer()) : Buffer.from('Transcript unavailable', 'utf-8');
            const transcriptAttachment = { attachment: Buffer.from(transcriptBuffer), name: `application-${targetUserId}.txt` };

            const notifyEmbed = new EmbedBuilder()
                .setTitle('NYPD Officer Application Accepted')
                .setColor('#2ECC71')
                .setImage(BANNER_IMAGE_URL)
                .setDescription(
                    `> **Applicant:** <@${targetUserId}>\n` +
                    `> **Status:** Accepted\n` +
                    `> **Reviewed By:** <@${interaction.user.id}>`
                )
                .setTimestamp();

            await interaction.message.channel.send({
                content: `Application for <@${targetUserId}> has been **ACCEPTED** by <@${interaction.user.id}>.`,
                embeds: [notifyEmbed],
                files: [transcriptAttachment]
            });

            try {
                await interaction.message.delete();
            } catch (e) {}

        } else {
            if (targetMember) {
                const declineDmEmbed = new EmbedBuilder()
                    .setTitle('NYPD Officer Application Update')
                    .setColor('#E74C3C')
                    .setImage(BANNER_IMAGE_URL)
                    .setDescription(
                        '> Dear **' + targetMember.user.username + '**,\n\n' +
                        'We regret to inform you that your officer application for **New York Police Department (NYPD)** has been declined after careful review by our administrative team.\n\n' +
                        '• **Processed By:** ' + interaction.user.tag + '\n\n' +
                        'Unfortunately, your application did not meet our current requirements or standards for the position. No roles have been assigned to your account.'
                    )
                    .setFooter({ text: 'New York Police Department Management Division' })
                    .setTimestamp();

                await targetMember.send({ embeds: [declineDmEmbed] }).catch(() => {});
            }

            const transcriptBuffer = interaction.message.attachments.first() ? (await (await fetch(interaction.message.attachments.first().url)).arrayBuffer()) : Buffer.from('Transcript unavailable', 'utf-8');
            const transcriptAttachment = { attachment: Buffer.from(transcriptBuffer), name: `application-${targetUserId}.txt` };

            const notifyEmbed = new EmbedBuilder()
                .setTitle('NYPD Officer Application Declined')
                .setColor('#E74C3C')
                .setImage(BANNER_IMAGE_URL)
                .setDescription(
                    `> **Applicant:** <@${targetUserId}>\n` +
                    `> **Status:** Declined\n` +
                    `> **Reviewed By:** <@${interaction.user.id}>`
                )
                .setTimestamp();

            await interaction.message.channel.send({
                content: `Application for <@${targetUserId}> has been **DECLINED** by <@${interaction.user.id}>.`,
                embeds: [notifyEmbed],
                files: [transcriptAttachment]
            });

            try {
                await interaction.message.delete();
            } catch (e) {}
        }
    }
});

// --- APPLICATION QUESTIONNAIRE LOGIC ---
const applicationQuestions = [
    "State your Roblox Username.",
    "State your age.",
    "Do you have previous law enforcement experience? If yes, what was your highest rank?",
    "Why do you want to become a New York City Police Officer?",
    "What can you contribute to the New York Police Department?",
    "What are the primary responsibilities of the New York Police Department?",
    "Why is professionalism important when interacting with civilians and other departments?",
    "You stop a vehicle for speeding, but the driver becomes disrespectful. How would you handle the traffic stop?",
    "You arrive first at the scene of a Hostage Situation. What would you do first?",
    "Another Officer is violating department policies during a patrol. What actions would you take?",
    "You receive a report of an armed robbery suspect fleeing at high speed. What factors would you consider before initiating or continuing a pursuit?",
    "Approximately how many hours can you contribute each week?",
    "Are you willing to attend mandatory trainings and patrols? (select option yes/no)",
    "Do you have anything to say before submitting this application?"
];

async function askNextQuestion(user) {
    const session = activeApplications.get(user.id);
    if (!session) return;

    if (session.step < applicationQuestions.length) {
        const questionText = applicationQuestions[session.step];
        
        const questionEmbed = new EmbedBuilder()
            .setTitle(`Question ${session.step + 1} of ${applicationQuestions.length}`)
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL)
            .setDescription(`> ${questionText}`);

        const sentMessage = await user.send({ embeds: [questionEmbed] });
        session.lastQuestionMessage = sentMessage;

        session.timeoutTimer = setTimeout(() => {
            if (activeApplications.has(user.id)) {
                user.send('Your application session has timed out due to inactivity. Please restart via the server panel.');
                activeApplications.delete(user.id);
            }
        }, 1200000);
    }
}

async function sendFinalSubmissionPrompt(user) {
    const session = activeApplications.get(user.id);
    if (!session) return;

    const finalEmbed = new EmbedBuilder()
        .setTitle('NYPD Application Review')
        .setColor(EMBED_COLOR)
        .setImage(BANNER_IMAGE_URL)
        .setDescription('> By submitting this application, you confirm that all information provided is truthful and understand that providing false information may result in denial of your application or removal from the department.');

    const submitRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('submit_app_final').setLabel('Submit Application').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel_app_final').setLabel('Cancel Application').setStyle(ButtonStyle.Danger)
    );

    await user.send({ embeds: [finalEmbed], components: [submitRow] });

    session.timeoutTimer = setTimeout(() => {
        if (activeApplications.has(user.id)) {
            user.send('Your application session has timed out due to inactivity. Please restart via the server panel.');
            activeApplications.delete(user.id);
        }
    }, 1200000);
}

async function finalizeApplicationSubmission(user) {
    const session = activeApplications.get(user.id);
    if (!session) return;

    const logChannel = client.channels.cache.get(STAFF_APP_LOG_CHANNEL);
    if (logChannel) {
        let transcriptString = `=== NEW YORK POLICE DEPARTMENT - OFFICER APPLICATION TRANSCRIPT ===\n`;
        transcriptString += `Applicant: ${user.tag} (${user.id})\n`;
        transcriptString += `Submission Timestamp: ${new Date().toUTCString()}\n\n`;

        for (let i = 0; i < applicationQuestions.length; i++) {
            transcriptString += `[Question ${i + 1}]: ${applicationQuestions[i]}\n`;
            transcriptString += `[Answer]: ${session.answers[i] || 'No response'}\n\n`;
        }

        const transcriptBuffer = Buffer.from(transcriptString, 'utf-8');
        const transcriptAttachment = { attachment: transcriptBuffer, name: `application-${user.id}.txt` };

        const logEmbed = new EmbedBuilder()
            .setTitle('NYPD Officer Application')
            .setColor(EMBED_COLOR)
            .setImage(BANNER_IMAGE_URL);

        for (let i = 0; i < applicationQuestions.length; i++) {
            logEmbed.addFields({
                name: `${i + 1}. ${applicationQuestions[i]}`,
                value: `> ${session.answers[i] || 'No response'}`,
                inline: false
            });
        }

        const reviewRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`accept_app_${user.id}`).setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`decline_app_${user.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger)
        );

        await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment], components: [reviewRow] }).catch(err => console.error('Failed to send application log:', err));
    }

    activeApplications.delete(user.id);
}

client.login(BOT_TOKEN);