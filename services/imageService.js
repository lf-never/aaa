const log = require('../log/winston').logger('Image Service');

const images = require('images');

/**
 * https://github.com/zhangyuanwei/node-images#readme
 */
const compressImage = async function () {
    try {
		images('e://a.png')
			.size(400)             
			.draw(images('e://minus.png'), 20, 20)  
			.save('e://b.jpg', {        
				quality: 100          
			});
		let imageBuffer = images('e://b.jpg').encode('jpg')
		console.log(imageBuffer.toString('base64'))
    } catch (err) {
        log.error('(login) : ', err);
    }
};
module.exports.compressImage = compressImage;

compressImage()
