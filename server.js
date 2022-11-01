/*============================[Modulos]============================*/
import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import exphbs from "express-handlebars";
import path from "path";
import User from "./src/models/User.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import "./src/db/config.js";
import { fork } from "child_process";
import minimist from "minimist";
import { clearScreenDown } from "readline";

const LocalStrategy = Strategy;

const app = express();

/*============================[Middlewares]============================*/

/*----------- Session -----------*/
app.use(cookieParser());
app.use(
  session({
    secret: "1234567890!@#$%^&*()",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 20000, //20 seg
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username }, (err, user) => {
      if (err) console.log(err);
      if (!user) return done(null, false);
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) console.log(err);
        if (isMatch) return done(null, user);
        return done(null, false);
      });
    });
  })
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findByID(id);
  return done(null, user);
});

/*----------- Motor de plantillas -----------*/
app.set("views", path.join(path.dirname(""), "./src/views"));
app.engine(
  ".hbs",
  exphbs.engine({
    defaultLayout: "main",
    layoutsDir: path.join(app.get("views"), "layouts"),
    extname: ".hbs",
  })
);
app.set("view engine", ".hbs");

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/*============================[Rutas]============================*/

app.get("/", (req, res) => {
  if (req.session.nombre) {
    res.redirect("/datos");
  } else {
    res.redirect("/login");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "login-error" }),
  (req, res) => {
    res.redirect("/datos");
  }
);

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", (req, res) => {
  const { username, password, direccion } = req.body;
  User.findOne({ username }, async (err, user) => {
    if (err) console.log(err);
    if (user) res.render("register-error");
    if (!user) {
      const hashedPassword = await bcrypt.hash(password, 8);
      const newUser = new User({
        username,
        password: hashedPassword,
        direccion,
      });
      await newUser.save();
      res.redirect("/login");
    }
  });
});

app.get("/datos", async (req, res) => {
  if (req.user) {
    const datosUsuario = await User.findeById(req.user._id).lean();
    res.render("datos", {
      datos: datosUsuario,
    });
  } else {
    res.redirect("/login");
  }
});
app.get("/info", (req, res) => {
  let datos = {
    argumentos: minimist(process.argv.slice(2)),
    plataforma: process.platform,
    versionNode: process.version,
    memoriaReservada: process.memoryUsage(),
    ejecutable: process.execPath,
    pid: process.pid,
    carpetaProyecto: process.cwd(),
  };

  res.json({ datos });
});

/* app.get("/api/randoms/", (req, res) => {
  const calculo = fork("random.js");
  const num = req.query.cant;

  calculo.on("message", (number) => {
    if (number == "listo") {
      calculo.send(num);
    } else {
      res.json({ number });
    }
  });
}); */

app.get("/api/randoms", (req, res) => {
  const calculo = fork("random.js");
  const num = req.query.cant;
  console.log(num)
  if (num) {
    calculo.on("message", (number) => {
      if (number == "listo") {
        calculo.send(num);
      } else {
        res.json({ number });
      }
    });
  } else {
    calculo.on("message", (number) => {
      if (number == "listo") {
        calculo.send(100000000);
      } else {
        res.json({ number });
      }
    });
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    res.redirect("/login");
  });
});

/*============================[Servidor]============================*/
const options = { default: { port: 8080 } };
const PORT = minimist(process.argv.slice(2), options);
const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
server.on("error", (error) => {
  console.error(`Error en el servidor ${error}`);
});
