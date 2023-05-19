// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        try {
            this.qnaMaker = new QnAMaker(configuration.QnAConfiguration);
        } catch (err) {
            console.warn(`QnAMaker Exception: ${ err } Check your QnAMaker configuration in .env`);
        }

        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)

        this.onMessage(async (context, next) => {

            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
            
            //console.log(LuisResult);

            // Determine which service to respond with //
            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                LuisResult.intents.GetAvailability.score > .6 &&
                LuisResult.entities.$instance && 
                LuisResult.entities.$instance.Date && 
                LuisResult.entities.$instance.Date[0]
            ) {
                const date = LuisResult.entities.$instance.Date[0].text;

                const availableSlots = await this.dentistScheduler.getAvailability();

                const responseMessage = availableSlots + " for " + date;

                await context.sendActivity(responseMessage);
                await next();
                return;
            }
            else if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .6 &&
                LuisResult.entities.$instance && 
                LuisResult.entities.$instance.Time && 
                LuisResult.entities.$instance.Time[0]
            ) {
                const time = LuisResult.entities.$instance.Time[0].text;
                
                const scheduleResponse = await this.dentistScheduler.scheduleAppointment(time);
                
                await context.sendActivity(scheduleResponse);
                await next();
                return;
            }
            else {
                // send user input to QnA Maker and collect the response in a variable
                // don't forget to use the 'await' keyword

                // Send user input to QnA Maker
                //const qnaResults = await this.qnaMaker.getAnswers(context);

                // If an answer was received from QnA Maker, send the answer back to the user.
                //if (qnaResults[0]) {
                //    console.log(qnaResults[0])
                //    await context.sendActivity(`${qnaResults[0].answer}`);
                //}
                //else {
                    // If no answers were returned from QnA Maker, reply with help.
                //    await context.sendActivity(`I'm not sure I can answer your question`);
                //}

                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity(`I'm not sure I can answer your question`);
            }
             
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            //write a custom greeting
            const welcomeText = "Welcome to the Contoso Dentistry Service. "
                + "You can ask general questions about our services and conditions, "
                + "query for available appointment time slots for a date "
                + "and book a timeslot for that date.";
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            // by calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
