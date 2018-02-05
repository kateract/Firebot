'use strict';

const SerialPort = require('serialport');
const util = require('../../utility');
const logger = require('../../logwrapper');
const {ipcMain} = require('electron');

var serialConnection = {
    connected: false,
    port: null,
    run: function(effect, trigger) {
        if (this.connected) logger.info('Sending to serial port: ' + effect.text);
        else logger.info("Connection not established, skipping sending: " + effect.text);
        return new Promise((resolve) => {
    
            if (effect == null || effect.text == null) return;
            if (this.connected) {
                this.write(effect.text);
            }
            resolve();
        });
    },
    checkPortValid: function(portName) {
        return new Promise((resolve, reject) => {
            SerialPort.list().then(ports => {
                logger.info(ports.map(p => {return p.comName;}));
                logger.info(portName);
                var valid = ports.map(p => {return p.comName;}).filter(p => {return p.comName == portName})
                logger.info(valid);
                if(valid.len = 1 ) resolve(valid);
                reject();
            }, (err) =>{ logger.error("Couldn't resolve serial port list"); reject();});
        });
    },
    setupPort: function(portName) {
        const Readline = SerialPort.parsers.Readline;
        this.port = new SerialPort(portName,{
            baudRate: 9600, xon: true, xoff: true,
            
        }, function(err) {
            if (err) {
                logger.error(err.message);
            }
        });
        const parser = new Readline();
        this.port.pipe(parser);

        var counter = 0
        ipcMain.on('serialport:update', (event, data) => {this.changePort(data);});
        this.port.on('open', () => {logger.info(portName + " open"); this.connected = true;});
        this.port.on('error', (err) => {if (err) logger.error(err.message)});
        parser.on('data', (data) => {counter++; logger.info(data.toString())});
        logger.info(portName + ' set up');
    },
    write: function(text) {
        this.port.write(text)
    },
    changePort: function(portDef) {
        if(connected) {
            this.port.close();
        }
        this.setupPort(portDef.Name);
    }

    
}


exports.run = serialConnection.run;
exports.setupPort = serialConnection.setupPort;
exports.checkPortValid = serialConnection.checkPortValid;
exports.changePort = serialConnection.changePort;
