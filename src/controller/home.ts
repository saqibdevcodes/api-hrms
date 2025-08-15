const home = (req:any, res:any) => {
    let name = 'Saqib Javaid'
    let age = 22

    res.json({name,age})
    
}

export default home