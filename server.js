var port = process.env.PORT || 8192;
var express = require('express');
var app = express();
var serv = require('https').Server(app);
var io = require('socket.io')(serv, {});
var argon = require("argon2");

serv.listen(port);
console.log("Server started at " + port);

var SOCKET_LIST = {};

const options = {
  timeCost: 8, memoryCost: 20, hashLength: 128, parallelism: 4, type: argon.argon2id
};
argon.hash('some-user-password', options).then(hash => {
  console.log('Successfully created Argon2 hash:', hash);
  argon.verify(hash, 'some-user-password').then(match => {
    if (match) {
      console.log("They match")
    } else {
      console.log("They don't")
    }
  }).catch(err => {
    console.log(err);
  });
});



io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  socket.on('spectateList', function(){
    console.log("Request for spectateList from " + socket.handshake.address);
    //TODO: Do this when I implement ranked
    //socket.emit('spectateList', Object.keys(Game.games).filter(function(x){ return x.type != "quick"; }));
    socket.emit('spectateList', Game.games);
  });

  socket.on('joinQueue', function(data){
    Player.onConnect(socket);
  });

  socket.on('spectate', function(data){

  });

  socket.on('playerMove', function(data){
    var game = Game.games[Player.list[socket.id].gameID];
    if(game.board[data.i1] == ""){
      if(socket.id == game.player2.id && game.moveCount % 2 === 0) {
        game.moveCount++;
        game.board[data.i1] = "x";
        SOCKET_LIST[game.player1.id].emit("playerMove", {s:"x", x:data.x, y:data.y});
        SOCKET_LIST[game.player2.id].emit("playerMove", {s:"x", x:data.x, y:data.y});
      }else if(socket.id == game.player1.id && game.moveCount % 2 == 1){
        game.moveCount++;
        game.board[data.i1] = "o";
        SOCKET_LIST[game.player1.id].emit("playerMove", {s:"o", x:data.x, y:data.y});
        SOCKET_LIST[game.player2.id].emit("playerMove", {s:"o", x:data.x, y:data.y});
      }
      if(game.moveCount > 4){
        var winner = checkWinner(game.board);
        this.winner = checkWinner(game.board);
        var w = this.winner,
          winner = w[0],
          shape = w[1][0],
          boardDisabled = game.boardDisabled;
        //If there is a winner, redraw winning tiles in red
        if (winner && !boardDisabled) {
          if (shape === "o") {
            for (var j = 1; j < 4; j++) {
            game.player1.wins++;
            game.player2.loses++;
              SOCKET_LIST[game.player1.id].emit("win", {p: "o", s:w[j][1], x:data.x, y:data.y});
              SOCKET_LIST[game.player2.id].emit("lose", {p: "o", s:w[j][1], x:data.x, y:data.y});
            }
          } else {
            game.player1.loses++;
            game.player2.wins++;
            for (var j = 1; j < 4; j++) {
              SOCKET_LIST[game.player1.id].emit("lose", {p: "x", s:w[j][1], x:data.x, y:data.y});
              SOCKET_LIST[game.player2.id].emit("win", {p: "x", s:w[j][1], x:data.x, y:data.y});
            }
          }
        }
        if ((winner || game.moveCount - 1 === game.board.length) && !boardDisabled) {
          console.log(w);
            if (!winner) {
            game.player1.ties++;
            game.player2.ties++;
                for (var j = 0; j < game.board.length; j++) {
                    if (game.board[j] === "o") {
                      SOCKET_LIST[game.player1.id].emit("lose", {p: "o", s:j, x:data.x, y:data.y});
                      SOCKET_LIST[game.player2.id].emit("lose", {p: "o", s:j, x:data.x, y:data.y});
                    } else {
                      SOCKET_LIST[game.player1.id].emit("lose", {p: "x", s:j, x:data.x, y:data.y});
                      SOCKET_LIST[game.player2.id].emit("lose", {p: "x", s:j, x:data.x, y:data.y});
                    }
                }
            }
            //TODO: update score and reset here
            game.boardDisabled = true;
            //this.updateScore();
            //this.reset();
        }
      }
    }
  });

  function checkWinner(mArr) {
      var winner = [false, ""];
      for (var i = 0; i < mArr.length; i++) {
          var hor = [],
              ver = [],
              diag = [];
          if (mArr[i] !== "") {
              //horizontal
              if (i % 3 === 0) {
                  for (var j = 0; j < 3; j++) {
                      hor.push([mArr[i + j], i + j]);
                  }
                  if (hor.length === 3) {
                      winner = isWinner(hor);
                      if (winner[0]) {
                          return winner;
                      }
                  }
              }
              //vertical && diag/anti diag
              if (i < 3) {
                  for (var j = 0; j + i < mArr.length; j += 3) {
                      ver.push([mArr[i + j], i + j]);
                  }
                  if (ver.length === 3) {
                      winner = isWinner(ver);
                      if (winner[0]) {
                          return winner;
                      }
                  }
                  if (i !== 1) {
                      for (var z = 0; z + i < mArr.length - i; z += (4 - i)) {
                          diag.push([mArr[i + z], i + z]);
                      }
                      if (diag.length === 3) {
                          winner = isWinner(diag);
                          if (winner[0]) {
                              return winner;
                          }
                      }
                  }
              }
          }
      }
      return winner;
  }

  function isWinner(arr) {
      arr.sort();
      var w = arr[0][0] && arr[0][0] === arr[arr.length - 1][0] ? [true].concat(arr) : [false, ""];
      return w;
  }

  socket.on('disconnect', function(data){
    console.log("Disconnecting");
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
  });

});

var Player = function(i){
  var self = {
    id: i,
    gameID: "",
    ranking: 0,
    wins: 0,
    loses: 0,
    ties: 0
  }

  return self;
}

Player.list = {};

Player.playerInQueue = null;

Player.onConnect = function(socket){
  var player = Player(socket.id);
  Player.list[socket.id] = player;
  console.log("Connecting player with id:" + player.id);
  if(Player.playerInQueue == null){
    Player.playerInQueue = player;
  } else{
    var game = Game(Player.playerInQueue, player);
    console.log("Creating a game for players " + Player.playerInQueue.id + "  " + player.id);
    game.start();
  }
}

Player.onDisconnect = function(socket){
  if(Player.playerInQueue != null && socket.id==Player.playerInQueue.id)
    Player.playerInQueue=null;
  else {
    console.log(socket.id);
    console.log(Player.list[socket.id]);
    var gameID = Player.list[socket.id].gameID;
    if(socket.id==Game.games[gameID].player1.id){
      SOCKET_LIST[Game.games[gameID].player2.id].emit('test', "Your opponent has disconnected!");
      Player.playerInQueue = Game.games[gameID].player2;
    }else {
      socket.emit("test", "Your opponent has disconnected!");
      Player.playerInQueue = Game.games[gameID].player1;
    }
    delete Game.games[gameID];
    delete Game.games[Player.list[socket.id].gameID];
  }
  delete Player.list[socket.id];
}

var Game = function(p1, p2){
  var self = {
    player1: p1,
    player2: p2,
    id: "",
    name: "",
    moveCount: 1,
    board: [],
    count: 0,
    boardDisabled: false,
    type: "quick"
  }

  for (var y = 0; y < 3; y++) {
      for (var x = 0; x < 3; x++) {
          self.board.push("");
      }
  }

  self.id = Math.random();

  self.start = function(){
    Player.playerInQueue = null;
    self.player1.gameID = self.id;
    self.player2.gameID = self.id;
    Game.games[self.id] = self;
    SOCKET_LIST[self.player1.id].emit('playerInfo', self.player2);
    SOCKET_LIST[self.player2.id].emit('playerInfo', self.player1);
  }

  return self;
}

Game.games = {};

setInterval(function(){
  for(var i in SOCKET_LIST)
    SOCKET_LIST[i].emit('online', Object.keys(SOCKET_LIST).length);
}, 1000);
