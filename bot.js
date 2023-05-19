// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { CustomQuestionAnswering } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {

        super();

        try {

            this.qnaMaker = new CustomQuestionAnswering(configuration.QnAConfiguration);
            this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);
            this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration)

        } catch (err) {
            console.warn(`Constructor exception: ${ err } Check your configuration in .env`);
        }
        
        this.onMessage(async (context, next) => {

            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
            
            console.log(LuisResult);

            if (LuisResult.luisResult.prediction.topIntent === "GetAvailability" &&
                LuisResult.intents.GetAvailability.score > .7) {
                
                var date = "today";

                if (LuisResult.entities.$instance && 
                    LuisResult.entities.$instance.Date && 
                    LuisResult.entities.$instance.Date[0]) 
                {
                    date = LuisResult.entities.$instance.Date[0].text;
                }
                const availableSlots = await this.dentistScheduler.getAvailability();

                const responseMessage = availableSlots + " for " + date;

                await context.sendActivity(responseMessage);
                await next();

                return;
            }
            else if (LuisResult.luisResult.prediction.topIntent === "ScheduleAppointment" &&
                LuisResult.intents.ScheduleAppointment.score > .7 &&
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
                
                const qnaResults = await this.qnaMaker.getAnswers(context);

                console.log(qnaResults);

                if (qnaResults[0]) {
                    await context.sendActivity(`${qnaResults[0].answer}`);
                }
                else {
                    await context.sendActivity(`I'm not sure I can answer your question`);
                }
            }
            
            await next();
        });

        this.onMembersAdded(async (context, next) => {
   
            const membersAdded = context.activity.membersAdded;
   
            const welcomeText = "Welcome to the Contoso Dentistry Service. "
                + "You can ask general questions about our services and conditions, "
                + "query for available appointment time slots for a date "
                + "and book a timeslot for that date.";
   
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
                }
            }
            
            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
