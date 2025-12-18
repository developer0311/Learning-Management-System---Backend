// import db from "../db";
import "dotenv/config";


export async function homepage_data(req, res) {

    let api_url = process.env.BASE_API_URL;
    api_url = api_url + "api/"
    res.render("homepage", {"base_api_url": api_url})
}