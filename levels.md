Level 1:  How important are different characters? 

Create one or several visualizations that allow me to accomplish the following tasks: 

    Give an overview of the show- you can use text or visualizations here.  Introduce your reader to your show, and give some context.  When did it run and on what platform?  How many seasons and episodes were in the show?  Who are the main characters?  What genre is it in? 
    I want to understand how important different characters are when considering 1) the show as a whole and 2) a selected season.  
        How many episodes do they appear in overall? 
        How much do they speak in the show overall? (lines or dialogue, or words could be used here).
    For the major characters, I want to be able to see which episodes they they appear in and which seasons.  How much do they speak in these episodes?
    Optional:
        Link out to Wikipedia or other fan pages for a character.
        Incorporating an icon or image for that character in your interface.   
        Incorporate the theme of the show in your page in some way.  Have fun! 
    Host this application publicly, using github.io or vercel or another hosting service

You can accomplish these goals through a combination of visual representations and interactions.  You can use bar charts, line chars, other appropriate representations, and for interactions you can use details on demand (like tooltips), brushing and linking, user interface elements.  Explain and justify your choices- how your user will accomplish these tasks and why you selected the visualization or interaction approach you chose.   

You can feel free to filter out characters who appear in 1 episode, or characters who are unnamed (guy #2), but recurring characters, or characters with many lines in at least one episode should be present in some way in your interface.  Justify your decisions on who you keep and exclude in your documentation.  

Level 2 goals:  All of the Level 1 goals, plus: 

Choose one of the following options.  Your choice can be based on your interests and your show.  Which do you think will be most interesting? 

    Option 1: What do characters say?   Given a selected character, create visual representations and interactions that help me understand what they tend to say.  For this option, use an encoding designed for text data (such as a word cloud or another representation we discuss in class).  You can add in additional views, like bar charts and line charts, but I want to see at least one other encoding that is designed for text data. 
        I want to see what words do they use most often, and how frequently they use them.  Note- you'll need to remove 'stem' words, (the, and, if, was....), to get at the more interesting things they say.  Or you can focus on words that are unique to them- like that they say more frequently than other characters.  
        I want to see if they have any sentences or phrases they say frequently?  For instance, if the show is Star Trek The Next Generation, Captain Picard likely says 'Captain's Log. Stardate' often.  Or if it is Futurama, Prof. Farnsworth says 'Good news, everyone!' 
        Does what they say tend to change from season to season?  Allow me to select either the whole show or a season and see what this character says for the selection. 
    Option 2: Who speaks to each other or appears in scenes together. For this option, use an encoding designed for network data (such as an arc diagram or a chord diagram).  You can add in additional views, like bar charts and line charts, but I want to see at least one other encoding that is designed for network data. 
        I want to understand which characters speak most often to or with each other- such as in the same scene, or in interlaced dialogue with each other.  Some scripts have scene cuts, and you can use that information to link the characters together.  Or you can look at how often a character's line is close to another character's line- as an approximation.  
            Note- this could be a considered a network or a graph, with weighted edges.  The upcoming lecture on graphs and networks, and tutorials on layouts, will help with this.  
        (EDITED) I want to be able to update this view to see how this changes over the run of the series.  You can choose to allow update by episode or by season or both.  
    UPDATE: As with the C-goals, host this application publicly, using github.io or vercel or another hosting service

Include design sketches to illustrate your design decisions, and discuss why you chose option 1 vs option 2. 

Level 3:   all of the Level 1 goals and the Level 2 goals plus: 

    If you chose option 1 for the previous goals, do option 2.  If you chose option 2 for the previous goals, do option 1.   As before, include sketches to illustrate your design decisions.   

Level 4 goals: 

    For your show, choose additional directions, based on what you know about the show.  This will likely need to be supported in an additional view of the data and through additional data pre-processing work and interactions.  Some ideas, but feel free to propose your own:

        Select two characters, and see what words they most often use when talking to each other- Do Jim and Pam say different things to each other (in the same scene) vs Pam and Michael in the Office? 
        Search for a word or a phrase see when it is first used and how frequently, and then see when it goes away over the course of the show.  For instance, when does the Smoke Monster discussed on Lost? 
            Add in a way to see who said this word or phrase most often? 
        Do you want to add information about where people are speaking- for instance if there is a scene description with a named location, you can show who speaks most often in that place.  For instance, if the show is West Wing maybe you want to show who speaks most often in the Oval Office vs the Situation Room.  Do they say different things in those rooms? 
        Show where these characters go over the course of the show, on a map.  This would be an interesting one for Game of Thrones or another show where characters travel around a lot. 
        Do you want to explore who speaks when in an episode- for example, be able to select a couple of characters and see when in all the episodes they tend to speak, or when in the season they tend to appear.  For instance, is Liz Lemon most often the first and last person to speak in episodes on 30 Rock?    
        Think about your show, and come up with some ideas of your own !  
