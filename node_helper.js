const NodeHelper = require("node_helper");
const fetch = require("node-fetch");

module.exports = NodeHelper.create({
    config: null,
    inverterIPs: [],

    start: function () {
        console.log("MMM-FroniusSolar5 node helper started");
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "SET_CONFIG_5") {
            this.config = payload;
            this.inverterIPs = Array.isArray(this.config.InverterIPs) ? 
                this.config.InverterIPs : 
                [this.config.InverterIPs || this.config.InverterIP];
            this.startFetchingData();
        } else if (notification === "GET_FRONIUS_DATA_5") {
            if (!this.config) return;
            this.getFroniusData();
        }
    },

    startFetchingData: function () {
        if (this.config && this.inverterIPs.length > 0) {
            this.fetchInterval = setInterval(() => {
                this.getFroniusData();
            }, this.config.updateInterval || 60000);
        }
    },

    getFroniusData: function () {
        if (!this.config || this.inverterIPs.length === 0) return;

        this.inverterIPs.forEach(ip => {
            this.fetchInverterData(ip);
        });
    },
    
    fetchInverterData: function(ip) {
        const url = `http://${ip}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`;

        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error for inverter ${ip}`);
                }
                return response.json();
            })
            .then(data => {
                const siteData = data.Body.Data.Site;
                const inverterData = data.Body.Data.Inverters ? data.Body.Data.Inverters["1"] : {};

                const result = {
                    inverterIP: ip,
                    data: {
                        P_Akku: siteData.P_Akku || 0,
                        P_Grid: siteData.P_Grid || 0,
                        P_Load: siteData.P_Load || 0,
                        P_PV: siteData.P_PV || 0,
                        Inverters: { "1": { SOC: inverterData.SOC || 0 } },
                    }
                };

                this.sendSocketNotification("FRONIUS_DATA_5", result);
            })
            .catch(error => {
                console.error(`Error fetching data from inverter ${ip}:`, error.message);
            });
    }
});