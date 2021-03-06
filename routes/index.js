require("dotenv/config");
var express = require("express");
var router = express.Router();
var request = require("request-promise");
const fetch = require("isomorphic-fetch");
var fs = require("fs");

var mongoose = require("mongoose");

mongoose.connect(
  "mongodb://" +
    process.env.DB_USER +
    ":" +
    process.env.DB_PASS +
    "@" +
    process.env.DB_HOST +
    "/" +
    process.env.DB_NAME,
  { useNewUrlParser: true }
);

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
    title: "Segunda via boleto",
    V3_PUBLIC: process.env.V3_PUBLIC,
    INPUT_INSCRICAO_PLACEHOLDER: process.env.INPUT_INSCRICAO_PLACEHOLDER
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
          secret: process.env.SECRET_KEY,
          response: req.body.token,
          remoteip: req.ip
        })
    );

    if (!result.success) {
      var erro = new Error("Por favor, tente novamente");
      next(erro);
      return;
    }

    var tNome = "";
    var tValorIntegral = "";
    var tNomearquivodesconto = "";
    var tValorParcela = "";
    var tNomearquivoparcela = "";
    var tNaoLocalizado = false;

    Boletos.findOne({
      cpfcnpj: req.body.cpfcnpj
        .normalize("NFD")
        .replace(/([\u0300-\u036f]|[^0-9])/g, ""),
      numeroregistro: req.body.numeroregistro
        .normalize("NFD")
        .replace(/([\u0300-\u036f]|[^0-9a-zA-Z])/g, "")
        .toUpperCase(),
      tipo: "00"
    })
      .lean()
      .exec(function(e, docs) {
        if (e) {
          var erro = new Error(e.message);
          next(erro);
          return;
        }

        if (docs !== null) {
          tNome = docs.nomesacado;
          tValorIntegral = docs.valor;
          tNomearquivodesconto = docs.nomearquivo;
        } else {
          //var erro = new Error("Cadastro não localizado");
          //next(erro);
          //return;
          tValorIntegral = 0;
          tNaoLocalizado = true;
        }

        Boletos.findOne({
          cpfcnpj: req.body.cpfcnpj
            .normalize("NFD")
            .replace(/([\u0300-\u036f]|[^0-9])/g, ""),
          numeroregistro: req.body.numeroregistro
            .normalize("NFD")
            .replace(/([\u0300-\u036f]|[^0-9a-zA-Z])/g, "")
            .toUpperCase(),
          tipo: "PP"
        })
          .lean()
          .exec(function(e, docs) {
            if (docs === null) {
              if (tNaoLocalizado === true) {
                var erro = new Error("Cadastro não localizado");
                next(erro);
                return;
              }
              tValorParcela = 0;
            } else {
              tNome = docs.nomesacado;
              tValorParcela = docs.valor;
              tNomearquivoparcela = docs.nomearquivo;
            }

            try {
              res.render("boleto", {
                title: "Segunda via boleto",
                cpfcnpj: req.body.cpfcnpj,
                inscricao: req.body.numeroregistro,
                nome: tNome,
                nomearquivodesconto: tNomearquivodesconto,
                nomearquivoparcelado: tNomearquivoparcela,
                valorIntegral: tValorIntegral,
                valorParcela: tValorParcela,
                vencimentoIntegral: process.env.VENCIMENTO_INTEGRAL,
                vencimentoParcela: process.env.VENCIMENTO_PARCELA,
                V3_PUBLIC: process.env.V3_PUBLIC
              });
              res.end();
            } catch (err) {
              var erro = new Error(err);
              next(erro);
            }
          });
      });
  } catch (err) {
    var erro = new Error(err);
    next(erro);
  }
});

router.post("/boleto", async function(req, res, next) {
  try {
    const result = JSON.parse(
      await request
        .post("https://www.google.com/recaptcha/api/siteverify")
        .form({
          secret: process.env.SECRET_KEY,
          response: req.body.token,
          remoteip: req.ip
        })
    );

    if (!result.success) {
      var erro = new Error("Por favor, tente novamente");
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
      ip: req.ip,
      arquivo: req.body.radio,
      valorIntegral: req.body.valorIntegral,
      valorParcela: req.body.valorParcela,
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
