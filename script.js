const fs = require('fs');
const request = require('request');

const drugStores = [];
let countOfDrugStores = 0;
let requests = 0;
let csvData = null;

function formatMessageToDash(message) {
    return message.split('').map(() => '-').join('');
}

function renderMessage(message) {
    const dashFromMessage = formatMessageToDash(message);
    console.log(`--------${dashFromMessage}--------`);
    console.log(`--------${message}--------`);
    console.log(`--------${dashFromMessage}--------`);
}

function timeStart(message) {
    renderMessage(message);
    console.time();
}

function timeReport(message) {
    renderMessage(message);
    console.timeEnd();
}

function areAllRequestsMade() {
    return requests === countOfDrugStores;
}

const readFilePromise = fileName => {
    if (csvData) {
        return Promise.resolve(csvData);
    }
    return new Promise((resolve, reject) => {
        timeStart('It begins...');
        fs.readFile(fileName, 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            csvData = data;
            return resolve(data);
        });
    });
};

const fillDrugstores = () => {
    if (drugStores.length) {
        return Promise.resolve(drugStores);
    }
    return readFilePromise(__dirname + '/data.csv').then(data => {
        const lines = data.split("\n");
        lines.forEach((el, idx) => {
            const drugStoreAsArr = el.split(',"');
            const city = drugStoreAsArr[0];
            const addressAndCompany = drugStoreAsArr[1].split('",');
            if (!addressAndCompany[0]) {
                addressAndCompany[0] = '';
            }
            if (!addressAndCompany[1]) {
                addressAndCompany[1] = '';
            }
            drugStores.push({
                'city': city.trim(),
                'address': addressAndCompany[0].toString().trim(),
                'company': addressAndCompany[1].toString().trim(),
                'lat': 0.0,
                'lng': 0.0
            });
        });
        timeReport('Data were read and extracted.');
        countOfDrugStores = drugStores.length;
        return drugStores;
    }).catch(err => console.error(err));
}

const makeRequest = (address, idx, parentResolve) => {
    return new Promise(function(resolve, reject) {
        request({
                    url: encodeURI('https://geocode-maps.yandex.ru/1.x/?format=json&geocode=' + address),
                    headers: {
                        'User-Agent': 'request'
                        // 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        // 'Accept-Encoding': 'gzip, deflate, sdch, br',
                        // 'Accept-Language': 'en-GB,en-US;q=0.8,en;q=0.6',
                        // 'Connection': 'keep-alive',
                        // 'Cookie': 'yandexuid=4349461661489103376; _ym_uid=14891325001030392842; L=CV5nAF9cZEV2WmwNblJtXV0BYgNpeQZMVTAVMjMwUgM=.1489132543.13001.397481.bed067f47d902c76586f61f3c5c9f23b; yandex_login=bafbaf92; yandex_gid=39; yabs-frequency=/4/0000000000000000/-d9oSFGf8VboSd3qAI6_BN9mz2aXkYroSFGf8TaiSd38AMu0/; i=X+YMI2qFVLPfBDaaSnhWr5VlzKHxnroZTkag0VSo2duAOk2GO20ICU+VDYrqpvo14JncW/GabK9njqb0CeD8X8NoIl4=; ys=udn.cDpiYWZiYWY5Mg%3D%3D#svt.1#ymrefl.F7D792D0B5638F1B#wprid.1494535997112781-1597687888996017392727696-vla1-1850; Session_id=3:1494615950.5.0.1489132543662:dtqTLg:87.0|171129699.0.2|163500.63448.C8XIph09CKTR-LtSZLVvY2WeC0k; sessionid2=3:1494615950.5.0.1489132543662:dtqTLg:87.1|171129699.0.2|163500.607584.8GoeTi2Vn_699ub5dIWJrRE4MyU; zm=m-white_bender.flex.webp.css-https-www%3Awww_KCNX-fTubUexxLehs33uaPG6e5Q%3Al; yp=1804463376.yrts.1489103376#1502012483.ww.1#1510473665.szm.1_00:1920x1080:1920x960#1804492543.udn.cDpiYWZiYWY5Mg%3D%3D#1524487483.dsws.2#1524487485.dswa.-1#1524487483.dwss.2#1497126731.los.1#1497126731.losc.0#1496153387.ygu.1#1524487485.dwsc.1',
                        // 'DNT': '1',
                        // 'Host': 'geocode-maps.yandex.ru',
                        // 'Upgrade-Insecure-Requests': '1',
                        // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
                        // 'X-Compress': 'null'
                    }
                }, 
        (error, response, body) => {
            requests++;
            if (error) {
                if (areAllRequestsMade()) {
                    timeReport('All requests were made.');
                    parentResolve(drugStores);
                }
                reject(`Cannot receive data for ${address}`);
                return;
            }
            const parseResponse = JSON.parse(body);
            let lng, lat;
            try {
                const pairLatLng = parseResponse.response.GeoObjectCollection.featureMember[0].GeoObject.Point.pos.split(' ');
                lng = parseFloat(pairLatLng[0]);
                lat = parseFloat(pairLatLng[1]);
            } catch(e) {
                // just write default
                lng = 0;
                lat = 0;
            }
            
            drugStores[idx].lat = lat;
            drugStores[idx].lng = lng;

            if ((areAllRequestsMade())) {
                timeReport('All requests were made.');
                parentResolve(drugStores);
            }
            // last resolve() will executed already after done of the programm LOL
            resolve();
        });
    });
};

const bulkRequests = stores => {
    timeStart('Begin make requests.');
    return new Promise((resolve, reject) => {
        let counter = 1;
        const countDrugstores = stores.length;
        stores.forEach((val, idx) => {
            makeRequest(val.address, idx, resolve).then(() => {
                console.log('Success request');
            }).catch(error => console.error(error));
        });
        return drugStores;
    });
};

fillDrugstores().then(stores => {
    bulkRequests(stores).then(stores => {
        let str = '';
        for (let i = 0; i < stores.length; i++) {
            str += `${stores[i].city}, ${stores[i].address}, ${stores[i].company}, ${stores[i].lat}, ${stores[i].lng} \n`;
        } 
        fs.writeFile(__dirname + '/result_js.csv', str);
        console.log('This is the end.');
    });
});