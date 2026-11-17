import React from 'react'
import { VEHICLES, formatCapacity } from '../vehicles'

const VehiclePanel = (props) => {
    // Best automatic offer per vehicle, from /rides/get-fare
    const offers = props.fare?.offers || {}
    return (
        <div>
            <h5
                className='p-1 text-center w-[93%] absolute top-0 cursor-pointer'
                onClick={() => props.setVehiclePanel(false)}
            >
                <i className="text-3xl text-gray-300 ri-arrow-down-wide-line"></i>
            </h5>
            <h3 className='text-2xl font-bold'>Choose a Vehicle</h3>
            <p className='text-xs text-gray-400 mb-4'>Pick the size that fits your goods</p>

            <div className='max-h-[62vh] overflow-y-auto pr-1'>
                {VEHICLES.map((v) => (
                    <div
                        key={v.key}
                        onClick={() => {
                            props.setConfirmRidePanel(true)
                            props.selectVehicle(v.key)
                        }}
                        className='flex border-2 border-gray-100 hover:border-black active:border-black mb-3 rounded-2xl w-full p-3.5 items-center justify-between cursor-pointer transition-all duration-200 hover:shadow-md bg-white'
                    >
                        <div className='h-12 w-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0'>
                            <i className={`${v.icon} text-2xl text-gray-800`}></i>
                        </div>
                        <div className='ml-3 flex-1 min-w-0'>
                            <h4 className='font-semibold text-base flex items-center gap-2'>
                                {v.label}
                                <span className='text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap'>
                                    up to {formatCapacity(v.capacityKg)}
                                </span>
                            </h4>
                            <p className='text-xs text-gray-500'>{v.desc}</p>
                            {offers[v.key] && (
                                <p className='text-[11px] font-semibold text-green-700 mt-0.5 truncate'>
                                    <i className='ri-price-tag-3-fill'></i> {offers[v.key].title} · ₹{offers[v.key].discount} off
                                </p>
                            )}
                        </div>
                        <div className='text-right pl-2'>
                            {offers[v.key] && props.fare?.[v.key] ? (
                                <>
                                    <p className='text-xs text-gray-400 line-through'>₹{props.fare[v.key]}</p>
                                    <h2 className='text-lg font-bold text-green-700'>₹{props.fare[v.key] - offers[v.key].discount}</h2>
                                </>
                            ) : (
                                <>
                                    <h2 className='text-lg font-bold text-gray-900'>
                                        {props.fare && props.fare[v.key] ? `₹${props.fare[v.key]}` : '₹--'}
                                    </h2>
                                    <p className='text-xs text-gray-400'>Estimate</p>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default VehiclePanel
