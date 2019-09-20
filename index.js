const mongoose = require("mongoose");
const authenticate = require("mm-authenticate")(mongoose);
const { Team, Match } = require("mm-schemas")(mongoose);

const send = (res, status, data) => (res.statusCode = status, res.end(data));

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });
mongoose.Promise = global.Promise;

const getMatchKey = (me, other) => {
  const [p1, p2] = [me, other].sort();
  return `logs/${p1}:${p2}`;
};

module.exports = authenticate(
  async (req, res ) => {
    console.log(req.url);
    if (req.url.startsWith("/leaderboard")) {
      const team = req.user;
      if (!team.admin) {
        send (res, 401, "Unauthorized");
        return;
      }
      
      console.log("Getting teams");
      const teams = await Team.find({})
        .populate("latestScript")
        .exec();
      const scripts = teams
        .filter(t => t.latestScript)
        .map(t => t.latestScript.key);

        const scoreMap = {};
        teams.filter(t => t.latestScript).forEach(t => {
          scoreMap[t.latestScript.key] = {
            team: t,
            wins: 0,
            losses: 0,
            ties: 0,
            score: 0,
            left: []
          };
        });

        let { matches } = scripts.reduce(
          (p, c) => {
            p.opponents.forEach(o => {
              p.matches.push(getMatchKey(c, o));
            });
            p.opponents.push(c);
            return p;
          },
          {
            opponents: [],
            matches: []
          }
        );

        matches = await Promise.all(
          matches.map(async key => ({
            key,
            match: await Match.findOne({ key }).exec()
          }))
        );

        matches.forEach(({ key, match }) => {
          const [p1, p2] = key.slice("logs/".length).split(":");
          if (!match) {
            scoreMap[p1].left.push(p2);
            scoreMap[p2].left.push(p1);
            return;
          }

          console.log(p1, p2, match.winner);
          if (match.winner === 0) {
            scoreMap[p1].ties++;
            scoreMap[p1].score++;
            scoreMap[p2].ties++;
            scoreMap[p2].score++;
          } else if (match.winner === 2) {
            scoreMap[p1].losses++;
            scoreMap[p2].wins++;
            scoreMap[p2].score += 3;
          } else {
            scoreMap[p2].losses++;
            scoreMap[p1].wins++;
            scoreMap[p1].score +=3;
          }
        });
        send(res, 200, JSON.stringify({ scores: scoreMap }));
    }
  }
)


// module.exports = authenticate(
//   router(
//     get("/leaderboard", async (req, res) => {
//       const team = req.user;
//       if (!team.admin) {
//         send(res, 401, "Unauthorized");
//         return;
//       }
//       console.log("Getting teams");
//       const teams = await Team.find({})
//         .populate("latestScript")
//         .exec();
//       const scripts = teams
//         .filter(t => t.latestScript)
//         .map(t => t.latestScript.key);

//       const scoreMap = {};
//       teams.filter(t => t.latestScript).forEach(t => {
//         scoreMap[t.latestScript.key] = {
//           team: t,
//           wins: 0,
//           losses: 0,
//           ties: 0,
//           score: 0,
//           left: []
//         };
//       });

//       let { matches } = scripts.reduce(
//         (p, c) => {
//           p.opponents.forEach(o => {
//             p.matches.push(getMatchKey(c, o));
//           });
//           p.opponents.push(c);
//           return p;
//         },
//         {
//           opponents: [],
//           matches: []
//         }
//       );

//       matches = await Promise.all(
//         matches.map(async key => ({
//           key,
//           match: await Match.findOne({ key }).exec()
//         }))
//       );

//       matches.forEach(({ key, match }) => {
//         const [p1, p2] = key.slice("logs/".length).split(":");
//         if (!match) {
//           scoreMap[p1].left.push(p2);
//           scoreMap[p2].left.push(p1);
//           return;
//         }
//         console.log(p1, p2, match.winner);
//         if (match.winner === 3) {
//           scoreMap[p1].ties++;
//           scoreMap[p1].score++;
//           scoreMap[p2].ties++;
//           scoreMap[p2].score++;
//         } else if (match.winner === 2) {
//           scoreMap[p1].losses++;

//           scoreMap[p2].wins++;
//           scoreMap[p2].score += 3;
//         } else {
//           scoreMap[p2].losses++;

//           scoreMap[p1].wins++;
//           scoreMap[p1].score += 3;
//         }
//       });
//       send(res, 200, JSON.stringify({ scores: scoreMap }));
//     })
//   )
// );
