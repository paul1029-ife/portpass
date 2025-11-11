#!/usr/bin/env node
import { startTunnel } from "../index.js";
import { nanoid } from "nanoid";

const localPort = process.argv[2] || 3000;
const clientId = nanoid(6);

const tunnelServer = "wss://portpass.up.railway.app";

startTunnel(localPort, tunnelServer, clientId);
