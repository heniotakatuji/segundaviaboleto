var express = require("express");
var router = express.Router();
var request = require("request-promise");
const fetch = require("isomorphic-fetch");
var fs = require("fs");

const siteKey = process.env.V3_PUBLIC;
const secretKey = process.env.SECRET_KEY;

var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:27017/db_got");
var Schema = mongoose.Schema;

var boletosDataSchema = new Schema(
  {
    pad: { type: String, required: true },
    nomesacado: String,
    guia: String,
    valor15: String,
    valor10: String,
    valor5: String,
    valorintegral: String,
    data15: String,
    data10: String,
    data5: String,
    dataintegral: String,
    nomearquivo: String
  },
  { collection: "boletos" }
);

var logDataSchema = new Schema(
  {
    cpfcnpj: String,
    inscricao: String,
    nome: String,
    ip: String,
    arquivo: String,
    data: String
  },
  { collection: "logs" }
);

var Boletos = mongoose.model("BoletoData", boletosDataSchema);
var Logs = mongoose.model("LogData", logDataSchema);

/* GET home page. */
router.get("/", function(req, res) {
  res.render("index", {
    title: "teste",
    V3_PUBLIC: process.env.V3_PUBLIC
  });
});

const handleSend = (req, res) => {
  const secret_key = process.env.SECRET_KEY;
  const token = req.body.token;
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${secret_key}&response=${token}`;

  fetch(url, {
    method: "post"
  })
    .then(response => response.json())
    .then(google_response => res.json({ google_response }))
    .catch(error => res.json({ error }));
};
router.post("/send", handleSend);

router.post("/", async function(req, res, next) {
  try {
    const result = JSON.parse(
      await request
        .post("https://www.google.com/recaptcha/api/siteverify")
        .form({
          secret: secretKey,
          response: req.body.token,
          remoteip: req.ip
        })
    );
    console.log(req.ip);
    if (!result.success) {
      console.log(false);
      var erro = new Error("Problema de Captcha");
      next(erro);
      return;
    }

    Boletos.findOne({
      cpf: req.body.cpfcnpj
        .normalize("NFD")
        .replace(/([\u0300-\u036f]|[^0-9])/g, ""),
      numeroinscricao: req.body.numeroregistro
        .normalize("NFD")
        .replace(/([\u0300-\u036f]|[^0-9a-zA-Z])/g, "")
        .toUpperCase()
    })
      .lean()
      .exec(function(e, docs) {
        if (e) {
          res.status(500).json({ error: err.message });
          res.end();
          return;
        }

        if (docs == null) {
          var erro = new Error("Cadastro não localizado");
          next(erro);
        }

        try {
          res.render("boleto", {
            title: "teste",
            pad: docs.pad,
            nome: docs.nomesacado,
            cpfcnpj: req.body.cpfcnpj,
            numeroregistro: req.body.numeroregistro,
            valor15: docs.valor15,
            valor10: docs.valor10,
            valor5: docs.valor5,
            nomearquivodesconto: docs.nomearquivodesconto,
            nomearquivoparcelado: docs.nomearquivoparcelado,
            boletoIntegral: "kdjlfajlflaboletoIntegral",
            boletoParcela: "kdjlfajlflaboletoParcela",
            V3_PUBLIC: process.env.V3_PUBLIC
          });
          res.end();
        } catch (err) {
          var erro = new Error(err);
          next(erro);
        }
      });
  } catch (err) {
    var err = new Error(err);
    next(err);
  }
});

router.post("/boleto", async function(req, res, next) {
  try {
    const result = JSON.parse(
      await request
        .post("https://www.google.com/recaptcha/api/siteverify")
        .form({
          secret: secretKey,
          response: req.body.token,
          remoteip: req.ip
        })
    );

    if (!result.success) {
      var erro = new Error("Problema de Captcha");
      next(erro);
      return;
    }

    var files = fs.createReadStream(process.env.PATH_BOLETO + req.body.radio);
    files.on("error", function(err) {
      if (err.code == "ENOENT") {
        var erro = new Error("Boleto não localizado");
        next(erro);
      } else {
        var erro = new Error("Boleto não localizado");
        next(erro);
      }
    });

    files.on("open", function() {
      res.writeHead(200, {
        "Content-disposition": "attachment; filename=" + req.body.radio
      }); //here you can add more headers
      files.pipe(res);
    });

    var item = {
      cpfcnpj: req.body.cpfcnpj,
      inscricao: req.body.numeroregistro,
      nome: req.body.nome,
      id: req.ip,
      arquivo: req.body.radio,
      data: new Date()
    };
    var data = new Logs(item);
    data.save();
  } catch (err) {
    var erro = new Error(err);
    next(erro);
  }
});

module.exports = router;
